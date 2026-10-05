import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { Chunk, Effect, Schema, Stream } from "effect";
import { v7 as randomUUID } from "uuid";

import { dbMain, type Task } from "@/worker/db/index.ts";
import { createChangeBus } from "@/worker/db/change-bus.ts";
import type { DbEvent } from "@/worker/db/factory.ts";
import { createDatabase, createTableModule } from "@/worker/db/factory.ts";
import { createKvApi } from "@/worker/db/kv.ts";
import { setupOxkv } from "@/worker/db/oxkv-wasm.ts";
import { BaseSchema } from "@/worker/db/schema.ts";
import { openStore } from "@/worker/db/store.ts";

function run<A>(effect: Effect.Effect<A, unknown, never>): Promise<A> {
  return Effect.runPromise(effect);
}

/** Polls `predicate` until true, failing the test if it never becomes true. */
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

describe("dbMain.task", () => {
  beforeAll(setupOxkv);

  it("inserts, reads, updates, deletes", async () => {
    const id = randomUUID();
    await run(
      dbMain.task.set(id, { description: "buy milk", is_done: false }),
    );

    const inserted = await run(dbMain.task.get(id));
    expect(inserted.description).toBe("buy milk");
    expect(inserted.is_done).toBe(false);
    expect(inserted.created_at).toBeInstanceOf(Date);

    await run(
      dbMain.task.set(id, {
        description: inserted.description,
        is_done: true,
      }),
    );
    const updated = await run(dbMain.task.get(id));
    expect(updated.is_done).toBe(true);
    expect(updated.created_at).toEqual(inserted.created_at);
    expect(updated.modified_at.getTime()).toBeGreaterThanOrEqual(
      updated.created_at.getTime(),
    );

    expect(await run(dbMain.task.delete(id))).toBe(true);
    expect(await run(dbMain.task.exists(id))).toBe(false);
    await expect(run(dbMain.task.get(id))).rejects.toThrow();
  });

  it("fails reading a missing item and reports delete of it", async () => {
    await expect(run(dbMain.task.get("missing-id"))).rejects.toThrow();
    expect(await run(dbMain.task.delete("missing-id"))).toBe(false);
  });

  it("upserts like oxkv set", async () => {
    const id = randomUUID();
    expect(await run(dbMain.task.exists(id))).toBe(false);

    await run(
      dbMain.task.set(id, { description: "upserted", is_done: true }),
    );
    expect(await run(dbMain.task.exists(id))).toBe(true);

    const doc = await run(dbMain.task.get(id));
    expect(doc.description).toBe("upserted");
    expect(doc.is_done).toBe(true);

    await run(dbMain.task.delete(id));
  });

  it("streams initial data after writes", async () => {
    const seedId = randomUUID();
    await run(
      dbMain.task.set(seedId, {
        description: "stream seed",
        is_done: false,
      }),
    );

    const iterator = Stream.toAsyncIterable(
      dbMain.task.watch({ direction: "next" }),
    )[Symbol.asyncIterator]();

    // Await the first chunk so the subscription is provably live, instead of
    // sleeping a fixed interval and hoping the watcher attached in time.
    const initial = (await iterator.next()).value as Task[];

    const secondId = randomUUID();
    await run(
      dbMain.task.set(secondId, {
        description: "stream second",
        is_done: true,
      }),
    );

    const afterInsert = (await iterator.next()).value as Task[];
    await iterator.return?.(undefined);

    expect(initial.some((task) => task.id === seedId)).toBe(true);
    expect(afterInsert.length).toBe(initial.length + 1);
    expect(afterInsert.some((task) => task.id === secondId)).toBe(true);
  });

  it("emits exactly one watch chunk per write", async () => {
    const chunks: Task[][] = [];
    const iterator = Stream.toAsyncIterable(
      dbMain.task.watch({ direction: "next" }),
    )[Symbol.asyncIterator]();
    void (async () => {
      for (;;) {
        const result = await iterator.next();
        if (result.done) return;
        chunks.push(result.value);
      }
    })();

    // Bounded wait for the subscription to become live, instead of assuming a
    // fixed settle window is enough for the first queryRows to finish.
    await waitFor(() => chunks.length >= 1);

    await run(
      dbMain.task.set(randomUUID(), {
        description: "single chunk",
        is_done: false,
      }),
    );

    await waitFor(() => chunks.length >= 2);
    const afterWrite = chunks.length;

    // A duplicate notification would arrive as a third chunk; give it a
    // window to show up, then assert the write produced exactly one.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(chunks.length).toBe(afterWrite);

    await iterator.return?.(undefined);
    expect(afterWrite - 1).toBe(1);
  });

  it("paginates next and prev with limit", async () => {
    const pageIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = randomUUID();
      pageIds.push(id);
      await run(
        dbMain.task.set(id, {
          description: `page ${i}`,
          is_done: false,
        }),
      );
    }

    const collectLastChunk = (args: Parameters<typeof dbMain.task.watch>[0]) =>
      Effect.map(
        Stream.runCollect(Stream.take(dbMain.task.watch(args), 1)),
        (chunk) => Chunk.toReadonlyArray(chunk).at(0) ?? [],
      );

    const nextPage = await Effect.runPromise(
      collectLastChunk({ direction: "next", limit: 2 }),
    );
    const prevPage = await Effect.runPromise(
      collectLastChunk({ direction: "prev", limit: 2 }),
    );

    expect(nextPage.length).toBe(2);
    expect(prevPage.length).toBe(2);
    // The store is shared across every test in this file. Keys are uuid v7, so
    // key order is creation order: `prev` walks the newest keys first, so it
    // must surface exactly the two most recent rows this test created —
    // independent of whatever earlier tests left behind.
    expect(prevPage.map((task) => task.id)).toEqual([
      pageIds[2],
      pageIds[1],
    ]);
    expect(prevPage.at(-1)!.created_at.getTime()).toBeGreaterThanOrEqual(
      nextPage.at(-1)!.created_at.getTime(),
    );
  });
});

describe("kv api", () => {
  const kvApi = createKvApi({
    open: () => openStore("main"),
    bus: createChangeBus(),
  });

  beforeAll(setupOxkv);

  it("gets, sets and checks raw keys", async () => {
    expect(await run(kvApi.exists("kv:missing"))).toBe(false);

    await run(kvApi.set("kv:a", { n: 1 }));
    await run(kvApi.set("kv:b", "text"));

    expect(await run(kvApi.exists("kv:a"))).toBe(true);
    expect(await run(kvApi.get("kv:a"))).toEqual({ n: 1 });
    expect(await run(kvApi.get("kv:b"))).toBe("text");
    expect(await run(kvApi.get("kv:missing"))).toBeNull();

    expect(await run(kvApi.delete("kv:b"))).toBe(true);
    expect(await run(kvApi.delete("kv:b"))).toBe(false);
    expect(await run(kvApi.get("kv:b"))).toBeNull();
  });

  it("paginates and filters raw keys with gets", async () => {
    // Values are deliberately not single letters: oxkv matches bare terms
    // fuzzily with slop 2, so "kind:a" also matches "b" and the AND filter
    // would stop discriminating.
    await run(kvApi.set("docs:1", { kind: "alpha", n: 1 }));
    await run(kvApi.set("docs:2", { kind: "beta", n: 5 }));
    await run(kvApi.set("docs:3", { kind: "alpha", n: 9 }));

    const all = await run(
      kvApi.gets({
        direction: "next",
        startCursor: "docs:",
        endCursor: "docs:\uffff",
      }),
    );
    expect(all.map((entry) => entry.key)).toEqual([
      "docs:1",
      "docs:2",
      "docs:3",
    ]);

    const filtered = await run(
      kvApi.gets({
        direction: "next",
        startCursor: "docs:",
        endCursor: "docs:\uffff",
        query: "kind:alpha AND n:[5 TO 10]",
      }),
    );
    expect(filtered.map((entry) => entry.key)).toEqual(["docs:3"]);

    const limited = await run(
      kvApi.gets({
        direction: "prev",
        limit: 2,
        startCursor: "docs:\uffff",
      }),
    );
    expect(limited.map((entry) => entry.key)).toEqual(["docs:3", "docs:2"]);

    for (const key of ["docs:1", "docs:2", "docs:3"]) {
      await run(kvApi.delete(key));
    }
  });

  it("saves and loads the whole store", async () => {
    await run(kvApi.set("kv:roundtrip", { ok: true }));

    const snapshot = await run(kvApi.save());
    expect(snapshot).toBeInstanceOf(Uint8Array);
    expect(snapshot.byteLength).toBeGreaterThan(0);

    const count = await run(kvApi.load(snapshot));
    expect(count).toBeGreaterThan(0);
    expect(await run(kvApi.get("kv:roundtrip"))).toEqual({ ok: true });
  });

  it("commits transactional writes", async () => {
    const tx = await run(kvApi.beginTx());
    await run(tx.set("kv:tx", { staged: true }));

    expect(await run(tx.get("kv:tx"))).toEqual({ staged: true });
    expect(await run(kvApi.exists("kv:tx"))).toBe(false);

    await run(tx.commit());

    expect(await run(kvApi.exists("kv:tx"))).toBe(true);
    expect(await run(kvApi.get("kv:tx"))).toEqual({ staged: true });
  });

  it("rolls back staged changes", async () => {
    const tx = await run(kvApi.beginTx());
    await run(tx.set("kv:rollback", { gone: true }));
    await run(tx.rollback());

    expect(await run(kvApi.exists("kv:rollback"))).toBe(false);
  });

  it("deletes inside transactions", async () => {
    await run(kvApi.set("kv:txdel", { temp: true }));

    const tx = await run(kvApi.beginTx());
    expect(await run(tx.delete("kv:txdel"))).toBe(true);
    expect(await run(kvApi.exists("kv:txdel"))).toBe(true);

    await run(tx.commit());

    expect(await run(kvApi.exists("kv:txdel"))).toBe(false);
  });

  it("reads uncommitted writes inside a transaction", async () => {
    const tx = await run(kvApi.beginTx());
    await run(tx.set("kv:tx1", { n: 1 }));

    expect(await run(tx.get("kv:tx1"))).toEqual({ n: 1 });
    expect(await run(kvApi.exists("kv:tx1"))).toBe(false);

    await run(tx.rollback());
  });

  it("scans only the requested prefix, never leaking other table rows", async () => {
    const id = randomUUID();
    await run(
      dbMain.task.set(id, {
        description: "hidden from kv scan",
        is_done: false,
      }),
    );
    await run(kvApi.set("docs:visible", { n: 1 }));

    const entries = await run(kvApi.gets({
      direction: "next",
      startCursor: `docs:`,
      endCursor: `docs:\uffff`,
    }));

    // The range covers `docs:` only, so the task row written above must not
    // appear — that is the property the test name advertises.
    expect(entries.map((entry) => entry.key)).toEqual(["docs:visible"]);
    expect(entries.every((entry) => !entry.key.startsWith("task:"))).toBe(
      true,
    );
  });
});

describe("db event bus", () => {
  beforeAll(setupOxkv);

  it("publishes set and delete events to subscribers in order", async () => {
    const collected: DbEvent[] = [];

    const CollectorTable = createTableModule({
      name: "collector",
      schema: BaseSchema.pipe(
        Schema.extend(Schema.Struct({ description: Schema.NonEmptyString })),
      ),
    });

    const db = createDatabase("events-test", { collector: CollectorTable }, {
      setup: (ctx) =>
        ctx.onEvent((event) =>
          Effect.sync(() => {
            collected.push(event);
          })
        ),
    });

    const id = randomUUID();
    await run(db.collector.set(id, { description: "watched" }));

    expect(collected).toEqual([
      { kind: "set", table: "collector", id, doc: expect.anything() },
    ]);

    await run(db.collector.delete(id));

    expect(collected.map((event) => event.kind)).toEqual(["set", "delete"]);
  });
});
