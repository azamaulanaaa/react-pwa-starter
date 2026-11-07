import "fake-indexeddb/auto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Effect, Exit, Option, Schema, Scope, Stream, Struct } from "effect";

import { createEventBus } from "@/worker/db/change-bus.ts";
import { createDatabase, createTableModule } from "@/worker/db/factory.ts";
import { setupOxkv } from "@/worker/db/oxkv-wasm.ts";
import { createDbFs } from "@/worker/db/persistence.ts";
import { BaseSchema } from "@/worker/db/schema.ts";
import { OutboxError } from "@/worker/outbox/error.ts";
import {
  createOutbox,
  type CreateOutboxOptions,
} from "@/worker/outbox/runtime.ts";
import { TableOutbox, type OutboxTableApi } from "@/worker/outbox/table.ts";

const RecordSchema = BaseSchema.mapFields(
  Struct.assign(
    Schema.Struct({
      label: Schema.NonEmptyString,
    }).fields,
  ),
);

const TableRecord = createTableModule({ name: "record", schema: RecordSchema });

function run<A>(effect: Effect.Effect<A, unknown, never>): Promise<A> {
  return Effect.runPromise(effect);
}

const scopes: Scope.Closeable[] = [];

function createTestOutbox(
  name: string,
  root: string,
  options: Partial<Omit<CreateOutboxOptions, "table">> = {},
) {
  const events = createEventBus();
  const dbFs = createDbFs({ outbox: TableOutbox, record: TableRecord }, root);
  dbFs.attach(events);
  const db = createDatabase(
    name,
    { outbox: TableOutbox, record: TableRecord },
    { events, hydrate: dbFs.hydrate },
  );
  const scope = Effect.runSync(Scope.make());
  scopes.push(scope);
  const runtime = Effect.runSync(
    Scope.provide(scope)(createOutbox({ table: db.outbox, ...options })),
  );

  return { db, runtime, scope };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 2000,
  intervalMs = 5,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

describe("outbox", () => {
  beforeAll(setupOxkv);

  afterEach(async () => {
    const open = scopes.splice(0);
    await Promise.all(open.map((scope) => run(Scope.close(scope, Exit.void))));
  });

  it("keeps an operation after a worker restart", async () => {
    const root = "db/outbox-restart";
    const first = createTestOutbox("outbox-restart-1", root, {
      now: () => 1000,
    });
    await run(first.runtime.ready);

    await run(
      first.runtime.registry.register("test.op", async () => ({ status: 200 })),
    );

    const op = await run(
      first.runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/test/restart",
        body: { value: 1 },
      }),
    );

    // The row is in the `sending` state when the worker stops.
    await run(
      first.db.outbox.set(op.id, {
        kind: op.kind,
        method: op.method,
        path: op.path,
        body: op.body,
        createdAt: op.createdAt,
        attempts: 1,
        nextAttemptAt: op.nextAttemptAt,
        state: "sending",
      }),
    );

    // A new database instance reads the same IndexedDB store again.
    const second = createTestOutbox("outbox-restart-2", root, {
      now: () => 2000,
    });
    await run(second.runtime.ready);

    const rows = await run(second.runtime.api.list());

    expect(rows.map((row) => row.id)).toEqual([op.id]);
    expect(rows[0]?.state).toBe("pending");
  });

  it("fails ready when recovery fails and raises no unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    try {
      const events = createEventBus();
      const root = "db/outbox-recovery-failure";
      const dbFs = createDbFs(
        { outbox: TableOutbox, record: TableRecord },
        root,
      );
      dbFs.attach(events);
      const db = createDatabase(
        "outbox-recovery-failure",
        { outbox: TableOutbox, record: TableRecord },
        { events, hydrate: dbFs.hydrate },
      );
      const table = {
        ...db.outbox,
        watch: () => Stream.fail(new Error("The storage is unavailable.")),
      } as unknown as OutboxTableApi;
      const scope = Effect.runSync(Scope.make());
      scopes.push(scope);
      const runtime = Effect.runSync(
        Scope.provide(scope)(createOutbox({ table })),
      );

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);

      const error = await run(Effect.flip(runtime.ready));
      expect(error).toBeInstanceOf(OutboxError);
      expect(error.reason).toBe("storage");
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("sends one operation twice with the same id", async () => {
    let clock = 1000;
    let calls = 0;
    const ids: string[] = [];
    const { runtime } = createTestOutbox(
      "outbox-duplicate",
      "db/outbox-duplicate",
      { now: () => clock, random: () => 0 },
    );
    await run(runtime.ready);

    await run(
      runtime.registry.register("test.op", async (op) => {
        calls += 1;
        ids.push(op.id);
        if (calls === 1) throw new Error("The network is down.");
        return { status: 200 };
      }),
    );

    const op = await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/test/duplicate",
      }),
    );

    await run(runtime.api.flush());

    const afterFailure = await run(runtime.api.list());
    expect(afterFailure).toHaveLength(1);
    expect(afterFailure[0]?.state).toBe("pending");

    clock += 300_000;
    await run(runtime.api.flush());

    expect(ids).toEqual([op.id, op.id]);
    expect(await run(runtime.api.list())).toHaveLength(0);
  });

  it("moves a conflict to the review state", async () => {
    const { runtime } = createTestOutbox(
      "outbox-conflict",
      "db/outbox-conflict",
    );
    await run(runtime.ready);

    await run(
      runtime.registry.register("test.op", async () => ({
        status: 409,
        code: "conflict",
        message: "The record already has a decision.",
      })),
    );

    await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/test/conflict",
      }),
    );
    await run(runtime.api.flush());

    const rows = await run(runtime.api.list());
    const status = await run(runtime.api.status());

    expect(rows[0]?.state).toBe("conflict");
    expect(rows[0]?.lastError?.code).toBe("conflict");
    expect(status.conflict).toBe(1);
    expect(status.pending).toBe(0);
  });

  it("backs off after a server error", async () => {
    const clock = 5000;
    let calls = 0;
    const { runtime } = createTestOutbox(
      "outbox-backoff",
      "db/outbox-backoff",
      {
        now: () => clock,
        random: () => 0,
      },
    );
    await run(runtime.ready);

    await run(
      runtime.registry.register("test.op", async () => {
        calls += 1;
        return { status: 503 };
      }),
    );

    await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/test/backoff",
      }),
    );
    await run(runtime.api.flush());

    const rows = await run(runtime.api.list());
    const delay = (rows[0]?.nextAttemptAt ?? 0) - clock;

    expect(rows[0]?.state).toBe("pending");
    expect(rows[0]?.attempts).toBe(1);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(300_000);

    await run(runtime.api.flush());
    expect(calls).toBe(1);
  });

  it("drains in creation order", async () => {
    const seen: string[] = [];
    const { runtime } = createTestOutbox("outbox-order", "db/outbox-order", {
      now: () => 10_000,
    });
    await run(runtime.ready);

    await run(
      runtime.registry.register("test.op", async (op) => {
        seen.push(op.path);
        return { status: 200 };
      }),
    );

    await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/third",
        createdAt: 3000,
      }),
    );
    await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/first",
        createdAt: 1000,
      }),
    );
    await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/second",
        createdAt: 2000,
      }),
    );

    await run(runtime.api.flush());

    expect(seen).toEqual(["/first", "/second", "/third"]);
    expect(await run(runtime.api.list())).toHaveLength(0);
  });

  it("does not run two flushers at once", async () => {
    let calls = 0;
    let live = 0;
    let maximum = 0;
    const gate = deferred<void>();
    const { runtime } = createTestOutbox(
      "outbox-single-flight",
      "db/outbox-single-flight",
    );
    await run(runtime.ready);

    await run(
      runtime.registry.register("test.op", async () => {
        calls += 1;
        live += 1;
        maximum = Math.max(maximum, live);
        await gate.promise;
        live -= 1;
        return { status: 200 };
      }),
    );

    await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/test/single-flight",
      }),
    );

    const first = run(runtime.api.flush());
    await waitFor(() => calls === 1);
    const second = run(runtime.api.flush());
    await new Promise((resolve) => setTimeout(resolve, 20));
    gate.resolve();

    const [left, right] = await Promise.all([first, second]);

    expect(maximum).toBe(1);
    expect(calls).toBe(1);
    expect(left.sent).toBe(1);
    expect(right.sent).toBe(1);
  });

  it("shares one drain between two concurrent flush calls", async () => {
    let calls = 0;
    const gate = deferred<void>();
    const { runtime } = createTestOutbox(
      "outbox-shared-flush",
      "db/outbox-shared-flush",
    );
    await run(runtime.ready);

    await run(
      runtime.registry.register("test.op", async () => {
        calls += 1;
        await gate.promise;
        return { status: 200 };
      }),
    );

    await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/test/shared-flush",
      }),
    );

    const first = run(runtime.api.flush());
    await waitFor(() => calls === 1);
    const second = run(runtime.api.flush());
    await new Promise((resolve) => setTimeout(resolve, 20));
    gate.resolve();

    const [left, right] = await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(left).toEqual(right);
  });

  it("ends a pending flush when the scope closes", async () => {
    const entered = deferred<void>();
    const gate = deferred<void>();
    const { runtime, scope } = createTestOutbox(
      "outbox-shutdown",
      "db/outbox-shutdown",
    );
    await run(runtime.ready);

    await run(
      runtime.registry.register("test.op", async () => {
        entered.resolve();
        await gate.promise;
        return { status: 200 };
      }),
    );

    await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/test/shutdown",
      }),
    );

    const pending = run(runtime.api.flush()).then(
      (value) => ({ kind: "success" as const, value }),
      (error: unknown) => ({ kind: "error" as const, error }),
    );
    await entered.promise;

    await run(Scope.close(scope, Exit.void));

    const outcome = await run(
      Effect.promise(() => pending).pipe(Effect.timeoutOption(2000)),
    );
    expect(Option.isSome(outcome)).toBe(true);
    if (Option.isSome(outcome)) {
      const settled = outcome.value;
      expect(settled.kind).toBe("error");
      if (settled.kind === "error") {
        expect(settled.error).toBeInstanceOf(OutboxError);
      }
    }

    gate.resolve();
  });

  it("pauses the flush when the session is lost", async () => {
    let clock = 1000;
    let calls = 0;
    const { runtime } = createTestOutbox(
      "outbox-session",
      "db/outbox-session",
      {
        now: () => clock,
      },
    );
    await run(runtime.ready);

    await run(
      runtime.registry.register("test.op", async () => {
        calls += 1;
        return { status: 401, code: "unauthorized" };
      }),
    );

    await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/test/session",
      }),
    );
    await run(runtime.api.flush());

    const rows = await run(runtime.api.list());
    const status = await run(runtime.api.status());

    expect(rows[0]?.state).toBe("pending");
    expect(status.paused).toBe(true);
    expect(status.signInRequired).toBe(true);

    clock += 600_000;
    await run(runtime.api.flush());
    expect(calls).toBe(1);

    await run(runtime.api.resume());
    await run(runtime.api.flush());
    expect(calls).toBe(2);
  });

  it("removes the operation after a success", async () => {
    const { db, runtime } = createTestOutbox(
      "outbox-success",
      "db/outbox-success",
    );
    await run(runtime.ready);

    await run(
      runtime.registry.register("test.op", async () => ({
        status: 200,
        local: [
          {
            kind: "set",
            table: "record",
            id: "record-1",
            value: { label: "created" },
          },
        ],
      })),
    );

    await run(
      runtime.api.enqueue({
        kind: "test.op",
        method: "PUT",
        path: "/test/success",
      }),
    );
    await run(runtime.api.flush());

    expect(await run(runtime.api.list())).toHaveLength(0);

    const record = await run(db.record.get("record-1"));
    expect(record.label).toBe("created");
  });
});
