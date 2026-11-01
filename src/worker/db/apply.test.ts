import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { Effect, Layer, Schema, Struct } from "effect";
import { v7 as randomUUID } from "uuid";

import type { ChangePage, ChangeRow } from "@/lib/sync/changes.ts";
import { createChangeApplier, type ChangeApplier } from "@/worker/db/apply.ts";
import { createChangeBus } from "@/worker/db/change-bus.ts";
import { DbError } from "@/worker/db/error.ts";
import { createTableModule } from "@/worker/db/factory.ts";
import {
  createKvApi,
  KvApi,
  type KvService,
  tableKeys,
} from "@/worker/db/kv.ts";
import { setupOxkv } from "@/worker/db/oxkv-wasm.ts";
import { BaseSchema } from "@/worker/db/schema.ts";
import { openStore } from "@/worker/db/store.ts";
import { systemTables } from "@/worker/db/system.ts";
import { TableItem } from "@/worker/db/test-support.ts";

const NoteTable = createTableModule({
  name: "note",
  schema: BaseSchema.mapFields(
    Struct.assign(Schema.Struct({ text: Schema.NonEmptyString }).fields),
  ),
});

const tables = { item: TableItem, note: NoteTable, ...systemTables };

const SERVER_TIME = 1_761_792_000_000;
let storeCounter = 0;

function run<A>(effect: Effect.Effect<A, unknown, never>): Promise<A> {
  return Effect.runPromise(effect);
}

function itemValue(id: string, label = "item"): Record<string, unknown> {
  return {
    id,
    label,
    done: false,
    created_at: new Date(0).toISOString(),
    modified_at: new Date(0).toISOString(),
  };
}

function noteValue(id: string, text = "note"): Record<string, unknown> {
  return {
    id,
    text,
    created_at: new Date(0).toISOString(),
    modified_at: new Date(0).toISOString(),
  };
}

function liveRow(table: string, key: string, value: unknown): ChangeRow {
  return { table, key, seq: 1, deleted: false, value };
}

function page(
  rows: ChangeRow[],
  next: number,
  oldestSeq = 0,
  hasMore = false,
): ChangePage {
  return { rows, next, hasMore, oldestSeq, serverTimeMs: SERVER_TIME };
}

interface Harness {
  applier: ChangeApplier;
  kv: KvService;
  layer: Layer.Layer<KvApi>;
  bus: ReturnType<typeof createChangeBus>;
}

function createHarness(wrap?: (kv: KvService) => KvService): Harness {
  const bus = createChangeBus();
  const name = `apply-test-${storeCounter++}`;
  const open = () => openStore(name);
  const kv = createKvApi({ open, bus });
  const layer = KvApi.layer({ open, bus });
  const wrapped = wrap === undefined ? kv : wrap(kv);
  const applier = createChangeApplier({
    tables,
    kvLayer: Layer.succeed(KvApi, wrapped),
  });

  return { applier, kv, layer, bus };
}

async function listRows(kv: KvService, table: string) {
  return run(
    kv.gets({
      direction: "next",
      startCursor: tableKeys(table).lowerBound,
      endCursor: tableKeys(table).upperBound,
    }),
  );
}

describe("change apply", () => {
  beforeAll(setupOxkv);

  it("applies a page and stores the cursor in one commit", async () => {
    let commits = 0;
    const { applier, kv } = createHarness((base) => ({
      ...base,
      beginTx: () =>
        Effect.map(base.beginTx(), (tx) => ({
          ...tx,
          commit: () =>
            Effect.tap(tx.commit(), () =>
              Effect.sync(() => {
                commits += 1;
              }),
            ),
        })),
    }));
    const id = randomUUID();

    const result = await run(
      applier.applyPage({
        scope: "feed:1",
        since: 0,
        page: page([liveRow("item", id, itemValue(id, "one commit"))], 2),
      }),
    );

    const state = await run(applier.state("feed:1"));
    const stored = await run(kv.get(tableKeys("item").of(id)));

    expect(result.status).toBe("applied");
    expect(commits).toBe(1);
    expect(state?.cursor).toBe(2);
    expect(stored).toMatchObject({ label: "one commit" });
  });

  it("does not advance the cursor when a table write fails", async () => {
    const { applier, kv } = createHarness((base) => ({
      ...base,
      beginTx: () =>
        Effect.map(base.beginTx(), (tx) => ({
          ...tx,
          set: (key, value) =>
            key.startsWith("item:")
              ? Effect.fail(new DbError({ error: "table write failed" }))
              : tx.set(key, value),
        })),
    }));
    const id = randomUUID();

    await run(
      applier.applyPage({
        scope: "feed:1",
        since: 0,
        page: page([], 5),
      }),
    );

    await expect(
      run(
        applier.applyPage({
          scope: "feed:1",
          since: 5,
          page: page([liveRow("item", id, itemValue(id))], 6),
        }),
      ),
    ).rejects.toThrow();

    const state = await run(applier.state("feed:1"));

    expect(state?.cursor).toBe(5);
    expect(await run(kv.exists(tableKeys("item").of(id)))).toBe(false);
  });

  it("skips a bad row and records it in quarantine", async () => {
    const { applier, kv } = createHarness();
    const goodId = randomUUID();
    const badId = randomUUID();

    const result = await run(
      applier.applyPage({
        scope: "feed:1",
        since: 0,
        page: page(
          [
            liveRow("item", goodId, itemValue(goodId, "good")),
            liveRow("item", badId, { id: badId, label: "" }),
          ],
          2,
        ),
      }),
    );

    const item = await run(kv.get(tableKeys("item").of(goodId)));
    const quarantine = await listRows(kv, "quarantine");
    const state = await run(applier.state("feed:1"));

    expect(result.status).toBe("applied");
    if (result.status !== "applied") throw new Error("unexpected result");
    expect(result.quarantined).toBe(1);
    expect(item).toMatchObject({ label: "good" });
    expect(quarantine).toHaveLength(1);
    expect(quarantine[0]?.value).toMatchObject({
      row_key: badId,
      reason: "invalid_row",
    });
    expect(state?.cursor).toBe(2);
  });

  it("deletes a row when the tombstone arrives", async () => {
    const { applier, kv } = createHarness();
    const id = randomUUID();

    await run(
      applier.applyPage({
        scope: "feed:1",
        since: 0,
        page: page([liveRow("item", id, itemValue(id))], 1),
      }),
    );

    expect(await run(kv.exists(tableKeys("item").of(id)))).toBe(true);

    const result = await run(
      applier.applyPage({
        scope: "feed:1",
        since: 1,
        page: page(
          [{ table: "item", key: id, seq: 2, deleted: true, value: null }],
          2,
        ),
      }),
    );

    expect(result.status).toBe("applied");
    if (result.status !== "applied") throw new Error("unexpected result");
    expect(result.deleted).toBe(1);
    expect(await run(kv.exists(tableKeys("item").of(id)))).toBe(false);
  });

  it("returns resync_required when the cursor is below the floor", async () => {
    const { applier, kv } = createHarness();
    const id = randomUUID();

    const result = await run(
      applier.applyPage({
        scope: "feed:1",
        since: 5,
        page: page([liveRow("item", id, itemValue(id))], 11, 10),
      }),
    );
    const state = await run(applier.state("feed:1"));

    expect(result).toEqual({
      status: "resync_required",
      reason: "resync_required",
      oldestSeq: 10,
    });
    expect(state).toBeNull();
    expect(await run(kv.exists(tableKeys("item").of(id)))).toBe(false);
  });

  it("rejects a page that moves the cursor back", async () => {
    const { applier, kv } = createHarness();
    const id = randomUUID();

    const result = await run(
      applier.applyPage({
        scope: "feed:1",
        since: 10,
        page: page([liveRow("item", id, itemValue(id))], 9),
      }),
    );
    const state = await run(applier.state("feed:1"));

    expect(result).toEqual({
      status: "rejected",
      reason: "cursor_not_advanced",
    });
    expect(state).toBeNull();
    expect(await run(kv.exists(tableKeys("item").of(id)))).toBe(false);
  });

  it("rejects a page that repeats the cursor with more data", async () => {
    const { applier, kv } = createHarness();
    const id = randomUUID();

    const result = await run(
      applier.applyPage({
        scope: "feed:1",
        since: 10,
        page: page([liveRow("item", id, itemValue(id))], 10, 0, true),
      }),
    );
    const state = await run(applier.state("feed:1"));

    expect(result).toEqual({
      status: "rejected",
      reason: "cursor_not_advanced",
    });
    expect(state).toBeNull();
    expect(await run(kv.exists(tableKeys("item").of(id)))).toBe(false);
  });

  it("notifies the change bus once per table", async () => {
    const { applier, bus } = createHarness();
    const calls: string[] = [];
    const stopItem = bus.subscribe("item", () => calls.push("item"));
    const stopNote = bus.subscribe("note", () => calls.push("note"));

    const first = randomUUID();
    const second = randomUUID();
    const note = randomUUID();

    await run(
      applier.applyPage({
        scope: "feed:1",
        since: 0,
        page: page(
          [
            liveRow("item", first, itemValue(first, "first")),
            liveRow("item", second, itemValue(second, "second")),
            liveRow("note", note, noteValue(note)),
          ],
          3,
        ),
      }),
    );

    stopItem();
    stopNote();

    expect(calls.filter((name) => name === "item")).toHaveLength(1);
    expect(calls.filter((name) => name === "note")).toHaveLength(1);
  });

  it("applies the same page twice without a duplicate row", async () => {
    const { applier, kv } = createHarness();
    const id = randomUUID();
    const badId = randomUUID();
    const samePage = page(
      [
        liveRow("item", id, itemValue(id, "stable")),
        liveRow("item", badId, { id: badId, label: "" }),
      ],
      2,
    );

    await run(applier.applyPage({ scope: "feed:1", since: 0, page: samePage }));
    const second = await run(
      applier.applyPage({ scope: "feed:1", since: 0, page: samePage }),
    );

    const items = await listRows(kv, "item");
    const quarantine = await listRows(kv, "quarantine");
    const state = await run(applier.state("feed:1"));

    expect(second.status).toBe("applied");
    expect(items).toHaveLength(1);
    expect(quarantine).toHaveLength(1);
    expect(state?.cursor).toBe(2);
  });
});
