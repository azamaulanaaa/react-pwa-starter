import "fake-indexeddb/auto";
import { Effect, Stream } from "effect";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { type TableClearer, createTableClearer } from "@/worker/db/clear.ts";
import { createDatabase } from "@/worker/db/factory.ts";
import { setupOxkv } from "@/worker/db/oxkv-wasm.ts";
import { systemTables } from "@/worker/db/system.ts";
import { type Item, TableItem } from "@/worker/db/test-support.ts";
import { TableOutbox } from "@/worker/outbox/table.ts";

const persistence = {
  clear: vi.fn(() => Effect.void),
};

let clearer: TableClearer | null = null;

const db = createDatabase(
  "clear-tables",
  { item: TableItem, outbox: TableOutbox, ...systemTables },
  {
    setup: (ctx) => {
      clearer = createTableClearer({
        open: ctx.open,
        persistence,
        notify: ctx.notify,
      });
    },
  },
);

function clearTables(names: readonly string[]) {
  if (clearer === null) throw new Error("The table clearer is not ready.");

  return Effect.runPromise(clearer.clearTables(names));
}

describe("clearTables", () => {
  beforeAll(setupOxkv);

  it("removes only the tables that the caller names", async () => {
    await Effect.runPromise(
      db.item.set("item-1", { label: "clear me", done: false }),
    );
    await Effect.runPromise(
      db.outbox.set("op-1", {
        kind: "test.op",
        method: "PUT",
        path: "/test/clear",
        body: null,
        createdAt: 1000,
        attempts: 0,
        nextAttemptAt: 1000,
        state: "pending",
      }),
    );
    await Effect.runPromise(
      db.sync_state.set("scope-1", {
        scope: "scope-1",
        cursor: 4,
        updated_at: new Date(1000),
      }),
    );

    const result = await clearTables(["item", "sync_state", "quarantine"]);

    expect(result.tables).toEqual(["item", "sync_state", "quarantine"]);
    expect(result.removed).toBe(2);
    expect(await Effect.runPromise(db.item.exists("item-1"))).toBe(false);
    expect(await Effect.runPromise(db.sync_state.exists("scope-1"))).toBe(
      false,
    );
    expect(await Effect.runPromise(db.outbox.exists("op-1"))).toBe(true);
    expect(persistence.clear).toHaveBeenCalledWith("item");
    expect(persistence.clear).toHaveBeenCalledWith("sync_state");
    expect(persistence.clear).toHaveBeenCalledWith("quarantine");
    expect(persistence.clear).not.toHaveBeenCalledWith("outbox");
  });

  it("notifies the change bus after a table clear", async () => {
    await Effect.runPromise(
      db.item.set("item-watch", { label: "watch me", done: false }),
    );

    const iterator = Stream.toAsyncIterable(
      db.item.watch({ direction: "next" }),
    )[Symbol.asyncIterator]();
    const initial = (await iterator.next()).value as Item[];

    expect(initial.some((item) => item.id === "item-watch")).toBe(true);

    await clearTables(["item"]);

    const after = (await iterator.next()).value as Item[];
    await iterator.return?.(undefined);

    expect(after.some((item) => item.id === "item-watch")).toBe(false);
  });

  it("removes each table name one time", async () => {
    await Effect.runPromise(
      db.item.set("item-2", { label: "once", done: false }),
    );

    const result = await clearTables(["item", "item"]);

    expect(result.tables).toEqual(["item"]);
    expect(result.removed).toBe(1);
  });
});
