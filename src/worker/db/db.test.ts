import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Chunk, Effect, Stream } from "effect";
import initOxkv from "oxkv";
import { v7 as randomUUID } from "uuid";

import { dbMain, type Task } from "@/worker/db/index.ts";
import { createChangeBus } from "@/worker/db/change-bus.ts";
import { createKvApi } from "@/worker/db/kv.ts";
import { openStore } from "@/worker/db/store.ts";

const wasmUrl = new URL(
  "../../../node_modules/oxkv/oxkv_bg.wasm",
  import.meta.url,
);

function run<A>(effect: Effect.Effect<A, unknown, never>): Promise<A> {
  return Effect.runPromise(effect);
}

async function firstTwoChunks(
  streamFactory: () => ReturnType<typeof dbMain.task.watch>,
): Promise<Task[][]> {
  const iterator = Stream.toAsyncIterable(
    streamFactory(),
  )[Symbol.asyncIterator]();

  const chunks: Task[][] = [];
  while (chunks.length < 2) {
    const result = await iterator.next();
    if (result.done) break;
    chunks.push(result.value);
  }
  await iterator.return?.(undefined);
  return chunks;
}

describe("dbMain.task", () => {
  beforeAll(async () => {
    await initOxkv(readFileSync(wasmUrl) satisfies BufferSource);
  });

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
    await run(
      dbMain.task.set(randomUUID(), {
        description: "stream seed",
        is_done: false,
      }),
    );

    const chunksPromise = firstTwoChunks(() =>
      dbMain.task.watch({ direction: "next" }),
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    await run(
      dbMain.task.set(randomUUID(), {
        description: "stream second",
        is_done: true,
      }),
    );

    const [initial, afterInsert] = await chunksPromise;
    expect(initial.length).toBeGreaterThanOrEqual(1);
    expect(afterInsert.length).toBe(initial.length + 1);
    expect(
      afterInsert.some((task) => task.description === "stream second"),
    ).toBe(true);
  });

  it("paginates next and prev with limit", async () => {
    for (let i = 0; i < 3; i++) {
      await run(
        dbMain.task.set(randomUUID(), {
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
    expect(prevPage.map((task) => task.description)).toEqual([
      "page 2",
      "page 1",
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

  beforeAll(async () => {
    await initOxkv(readFileSync(wasmUrl) satisfies BufferSource);
  });

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
    await run(kvApi.set("docs:1", { kind: "a", n: 1 }));
    await run(kvApi.set("docs:2", { kind: "b", n: 5 }));
    await run(kvApi.set("docs:3", { kind: "a", n: 9 }));

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
        query: "kind:a AND n:[5 TO 10]",
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

  it("filters table rows out of raw scans", async () => {
    const id = randomUUID();
    await run(
      dbMain.task.set(id, { description: "hidden from kv scan", is_done: false }),
    );
    await run(kvApi.set("docs:visible", { n: 1 }));

    const entries = await run(kvApi.gets({
      direction: "next",
      startCursor: `docs:`,
      endCursor: `docs:\uffff`,
    }));

    expect(entries.some((entry) => entry.key === "docs:visible")).toBe(true);
  });
});
