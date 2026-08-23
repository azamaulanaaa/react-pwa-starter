import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { BTreeStore } from "oxkv";
import { v7 as randomUUID } from "uuid";
import { Effect } from "effect";

import { dbMain } from "@/worker/db/index.ts";
import { fs as fsMain } from "@/worker/fs/index.ts";
import { hydrateStore } from "@/worker/db/factory.ts";
import { createFsPersistence, loadSnapshot } from "@/worker/db-fs/index.ts";
import { setupOxkv } from "@/worker/db/oxkv-wasm.ts";

function run<A>(effect: Effect.Effect<A, unknown, never>): Promise<A> {
  return Effect.runPromise(effect);
}

const persistence = createFsPersistence();

describe("db-fs: persistent db cycle", () => {
  beforeAll(setupOxkv);

  it("persists every write, restores on load, and removes on delete", async () => {
    const id = randomUUID();
    const path = `db/main/task/${id}`;
    const key = `task:${id}`;

    await run(
      dbMain.task.set(id, { description: "durable milk", is_done: false }),
    );

    expect(await run(fsMain.exists(path))).toBe(true);

    const raw = await run(fsMain.readFile(path));
    const stored = JSON.parse(
      typeof raw === "string" ? raw : new TextDecoder().decode(raw),
    );
    expect(stored.description).toBe("durable milk");
    expect(typeof stored.created_at).toBe("string");

    const fresh = new BTreeStore();
    const snapshot = await run(loadSnapshot(["task"], persistence));
    await run(hydrateStore(fresh, snapshot));
    const restored = await fresh.get(key);
    expect(restored).toMatchObject({ description: "durable milk" });

    await run(dbMain.task.set(id, {
      description: "durable milk 2",
      is_done: true,
    }));
    const updated = JSON.parse(
      String(await run(fsMain.readFile(path))),
    ) as Record<string, unknown>;
    expect(updated.description).toBe("durable milk 2");

    expect(await run(dbMain.task.delete(id))).toBe(true);
    expect(await run(fsMain.exists(path))).toBe(false);

    const afterDelete = new BTreeStore();
    const emptySnapshot = await run(loadSnapshot(["task"], persistence));
    await run(hydrateStore(afterDelete, emptySnapshot));
    expect(await afterDelete.get(key)).toBe(null);
  });
});
