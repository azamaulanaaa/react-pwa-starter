import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { Effect, Schema, Stream, Struct } from "effect";
import { type BTreeStore } from "oxkv";
import { v7 as randomUUID } from "uuid";

import { dbMain as defaultDb } from "@/worker/db/index.ts";
import { createChangeBus, createEventBus } from "@/worker/db/change-bus.ts";
import type { DbEvent } from "@/worker/db/factory.ts";
import { createDatabase, createTableModule } from "@/worker/db/factory.ts";
import { createKvApi, KvApi } from "@/worker/db/kv.ts";
import { setupOxkv } from "@/worker/db/oxkv-wasm.ts";
import { BaseSchema } from "@/worker/db/schema.ts";
import { openStore } from "@/worker/db/store.ts";
import { createTestDatabase, type Item } from "@/worker/db/test-support.ts";

const dbMain = createTestDatabase();

function run<A>(effect: Effect.Effect<A, unknown, never>): Promise<A> {
  return Effect.runPromise(effect);
}

/**
 * Calls `predicate` until it returns true.
 * The function fails the test when `predicate` never returns true.
 */
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

describe("dbMain.item", () => {
  beforeAll(setupOxkv);

  it("inserts, reads, updates, deletes", async () => {
    const id = randomUUID();
    await run(dbMain.item.set(id, { label: "buy milk", done: false }));

    const inserted = await run(dbMain.item.get(id));
    expect(inserted.label).toBe("buy milk");
    expect(inserted.done).toBe(false);
    expect(inserted.created_at).toBeInstanceOf(Date);

    await run(
      dbMain.item.set(id, {
        label: inserted.label,
        done: true,
      }),
    );
    const updated = await run(dbMain.item.get(id));
    expect(updated.done).toBe(true);
    expect(updated.created_at).toEqual(inserted.created_at);
    expect(updated.modified_at.getTime()).toBeGreaterThanOrEqual(
      updated.created_at.getTime(),
    );

    expect(await run(dbMain.item.delete(id))).toBe(true);
    expect(await run(dbMain.item.exists(id))).toBe(false);
    await expect(run(dbMain.item.get(id))).rejects.toThrow();
  });

  it("fails to read a missing item and returns false when it deletes it", async () => {
    await expect(run(dbMain.item.get("missing-id"))).rejects.toThrow();
    expect(await run(dbMain.item.delete("missing-id"))).toBe(false);
  });

  it("adds the document when it does not exist, like the oxkv set", async () => {
    const id = randomUUID();
    expect(await run(dbMain.item.exists(id))).toBe(false);

    await run(dbMain.item.set(id, { label: "upserted", done: true }));
    expect(await run(dbMain.item.exists(id))).toBe(true);

    const doc = await run(dbMain.item.get(id));
    expect(doc.label).toBe("upserted");
    expect(doc.done).toBe(true);

    await run(dbMain.item.delete(id));
  });

  it("streams the initial rows, then streams again after a write", async () => {
    const seedId = randomUUID();
    await run(
      dbMain.item.set(seedId, {
        label: "stream seed",
        done: false,
      }),
    );

    const iterator = Stream.toAsyncIterable(
      dbMain.item.watch({ direction: "next" }),
    )[Symbol.asyncIterator]();

    // The test awaits the first chunk, so the subscription is live.
    // A fixed sleep cannot prove that the watcher attached in time.
    const initial = (await iterator.next()).value as Item[];

    const secondId = randomUUID();
    await run(
      dbMain.item.set(secondId, {
        label: "stream second",
        done: true,
      }),
    );

    const afterInsert = (await iterator.next()).value as Item[];
    await iterator.return?.(undefined);

    expect(initial.some((item) => item.id === seedId)).toBe(true);
    expect(afterInsert.length).toBe(initial.length + 1);
    expect(afterInsert.some((item) => item.id === secondId)).toBe(true);
  });

  it("emits exactly one watch chunk per write", async () => {
    const chunks: Item[][] = [];
    const iterator = Stream.toAsyncIterable(
      dbMain.item.watch({ direction: "next" }),
    )[Symbol.asyncIterator]();
    void (async () => {
      for (;;) {
        const result = await iterator.next();
        if (result.done) return;
        chunks.push(result.value);
      }
    })();

    // The test waits with a limit until the subscription is live.
    // A fixed wait cannot prove that the first queryRows call finished.
    await waitFor(() => chunks.length >= 1);

    await run(
      dbMain.item.set(randomUUID(), {
        label: "single chunk",
        done: false,
      }),
    );

    await waitFor(() => chunks.length >= 2);
    const afterWrite = chunks.length;

    // A duplicate notification arrives as a third chunk.
    // The test waits for that chunk, then checks that the write made one chunk.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(chunks.length).toBe(afterWrite);

    await iterator.return?.(undefined);
    expect(afterWrite - 1).toBe(1);
  });

  it("paginates with direction `next` and direction `prev` and a limit", async () => {
    const pageIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = randomUUID();
      pageIds.push(id);
      await run(
        dbMain.item.set(id, {
          label: `page ${i}`,
          done: false,
        }),
      );
    }

    const collectLastChunk = (args: Parameters<typeof dbMain.item.watch>[0]) =>
      Effect.map(
        Stream.runCollect(Stream.take(dbMain.item.watch(args), 1)),
        (chunks) => chunks.at(0) ?? [],
      );

    const nextPage = await Effect.runPromise(
      collectLastChunk({ direction: "next", limit: 2 }),
    );
    const prevPage = await Effect.runPromise(
      collectLastChunk({ direction: "prev", limit: 2 }),
    );

    expect(nextPage.length).toBe(2);
    expect(prevPage.length).toBe(2);
    // Every test in this file uses the same store.
    // The keys are uuid v7, so the key order is the creation order.
    // A scan with direction `prev` returns the newest keys first.
    // The scan returns the two newest rows that this test created.
    // The result does not depend on the rows that the earlier tests created.
    expect(prevPage.map((item) => item.id)).toEqual([pageIds[2], pageIds[1]]);
    expect(prevPage.at(-1)!.created_at.getTime()).toBeGreaterThanOrEqual(
      nextPage.at(-1)!.created_at.getTime(),
    );
  });
});

describe("default database", () => {
  it("starts without a table", () => {
    expect(Object.keys(defaultDb as Record<string, unknown>)).toEqual([]);
  });
});

describe("empty table map", () => {
  it("starts an empty table map without an error", () => {
    const db = createDatabase("empty-table-map", {});

    expect(Object.keys(db as Record<string, unknown>)).toEqual([]);
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
    // Values are not single letters on purpose.
    // oxkv matches a bare term with a fuzzy match that has slop 2.
    // The query "kind:a" also matches "b".
    // The AND filter cannot tell the values apart.
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
      dbMain.item.set(id, {
        label: "hidden from kv scan",
        done: false,
      }),
    );
    await run(kvApi.set("docs:visible", { n: 1 }));

    const entries = await run(
      kvApi.gets({
        direction: "next",
        startCursor: `docs:`,
        endCursor: `docs:\uffff`,
      }),
    );

    // The range covers the prefix `docs:` only.
    // The item row that the test wrote above must not appear in the range.
    // The test name states this property.
    expect(entries.map((entry) => entry.key)).toEqual(["docs:visible"]);
    expect(entries.every((entry) => !entry.key.startsWith("item:"))).toBe(true);
  });
});

describe("db change bus", () => {
  it("notifies every subscriber of one table only", () => {
    const bus = createChangeBus();
    const calls: string[] = [];

    const stop = bus.subscribe("item", () => calls.push("first"));
    bus.subscribe("item", () => calls.push("second"));
    bus.subscribe("kv", () => calls.push("other table"));

    bus.notify("item");
    expect(calls).toEqual(["first", "second"]);

    stop();
    bus.notify("item");
    expect(calls).toEqual(["first", "second", "second"]);
  });
});

describe("watch teardown", () => {
  beforeAll(setupOxkv);

  const WatchedTable = createTableModule({
    name: "watched",
    schema: BaseSchema.mapFields(
      Struct.assign(Schema.Struct({ label: Schema.NonEmptyString }).fields),
    ),
  });

  /**
   * The bus counts its live listeners, so the test can wait for the release of
   * the subscription instead of waiting for a fixed time.
   */
  function createWatchedApi() {
    const bus = createChangeBus();
    let open: Promise<BTreeStore> | null = null;
    const openStoreOnce = () => (open ??= openStore("watch-teardown"));
    let listeners = 0;

    const api = WatchedTable.api({
      kvLayer: KvApi.layer({ open: openStoreOnce, bus }),
      open: openStoreOnce,
      subscribe: (tableName, listener) => {
        listeners += 1;
        const stop = bus.subscribe(tableName, listener);
        return () => {
          listeners -= 1;
          stop();
        };
      },
      notify: bus.notify,
      emit: () => Effect.void,
      onEvent: () => () => {},
    });

    return { api, listeners: () => listeners };
  }

  it("releases the change bus subscription when the consumer stops", async () => {
    const { api, listeners } = createWatchedApi();
    const chunks: unknown[][] = [];

    const iterator = Stream.toAsyncIterable(api.watch({ direction: "next" }))[
      Symbol.asyncIterator
    ]();
    void (async () => {
      for (;;) {
        const result = await iterator.next();
        if (result.done) return;
        chunks.push(result.value);
      }
    })();

    // The subscription is live after the first query finished.
    await waitFor(() => chunks.length >= 1);
    expect(listeners()).toBe(1);

    await iterator.return?.(undefined);
    await waitFor(() => listeners() === 0);

    // A write after the release must not reach the dead stream.
    await run(api.set(randomUUID(), { label: "after cancel" }));
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(listeners()).toBe(0);
    expect(chunks.length).toBe(1);
  });
});

describe("db event bus", () => {
  beforeAll(setupOxkv);

  it("publishes set and delete events to subscribers in order", async () => {
    const collected: DbEvent[] = [];

    const CollectorTable = createTableModule({
      name: "collector",
      schema: BaseSchema.mapFields(
        Struct.assign(Schema.Struct({ label: Schema.NonEmptyString }).fields),
      ),
    });

    const db = createDatabase(
      "events-test",
      { collector: CollectorTable },
      {
        setup: (ctx) =>
          ctx.onEvent((event) =>
            Effect.sync(() => {
              collected.push(event);
            }),
          ),
      },
    );

    const id = randomUUID();
    await run(db.collector.set(id, { label: "watched" }));

    expect(collected).toEqual([
      { kind: "set", table: "collector", id, doc: expect.anything() },
    ]);

    await run(db.collector.delete(id));

    expect(collected.map((event) => event.kind)).toEqual(["set", "delete"]);
  });

  it("stops calling a handler after unsubscribe", async () => {
    const bus = createEventBus();
    const collected: DbEvent[] = [];
    const event: DbEvent = {
      kind: "delete",
      table: "item",
      id: randomUUID(),
    };

    const stop = bus.subscribe((received) =>
      Effect.sync(() => {
        collected.push(received);
      }),
    );

    await run(bus.emit(event));
    stop();
    await run(bus.emit(event));

    expect(collected).toEqual([event]);
  });
});
