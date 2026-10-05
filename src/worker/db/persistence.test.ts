import "fake-indexeddb/auto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BTreeStore } from "oxkv";
import { v7 as randomUUID } from "uuid";
import { Cause, Effect, Exit, Option } from "effect";

import { dbMain } from "@/worker/db/index.ts";
import { dbStorage } from "@/worker/db/persistence.ts";
import { hydrateStore } from "@/worker/db/factory.ts";
import {
  createDbPersistence,
  createPeerSync,
  loadSnapshot,
} from "@/worker/db/persistence.ts";
import { setupOxkv } from "@/worker/db/oxkv-wasm.ts";

function run<A>(effect: Effect.Effect<A, unknown, never>): Promise<A> {
  return Effect.runPromise(effect);
}

const persistence = createDbPersistence();

describe("db persistence: persistent db cycle", () => {
  beforeAll(setupOxkv);

  it("persists every write, restores on load, and removes on delete", async () => {
    const id = randomUUID();
    const path = `db/main/task/${id}`;
    const key = `task:${id}`;

    await run(
      dbMain.task.set(id, { description: "durable milk", is_done: false }),
    );

    expect(await dbStorage.has(path)).toBe(true);

    const stored = (await dbStorage.getItem(path)) as Record<
      string,
      unknown
    >;
    expect(stored.description).toBe("durable milk");
    expect(typeof stored.created_at).toBe("string");

    const fresh = new BTreeStore();
    const snapshot = await run(loadSnapshot(["task"], persistence));
    await run(hydrateStore(fresh, snapshot));
    const restored = await fresh.get(key);
    expect(restored).toMatchObject({ description: "durable milk" });

    await run(
      dbMain.task.set(id, {
        description: "durable milk 2",
        is_done: true,
      }),
    );
    const updated = (await dbStorage.getItem(path)) as Record<
      string,
      unknown
    >;
    expect(updated.description).toBe("durable milk 2");

    expect(await run(dbMain.task.delete(id))).toBe(true);
    expect(await dbStorage.has(path)).toBe(false);

    const afterDelete = new BTreeStore();
    const emptySnapshot = await run(loadSnapshot(["task"], persistence));
    await run(hydrateStore(afterDelete, emptySnapshot));
    expect(await afterDelete.get(key)).toBe(null);
  });
});

const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
};

/** Returns the `DbError` payload of a failed exit. */
const failureMessage = (exit: Exit.Exit<unknown, unknown>): string => {
  if (!Exit.isFailure(exit)) return "";
  const failure = Cause.failureOption(exit.cause);
  if (Option.isNone(failure)) return String(exit.cause);
  const error = (failure.value as { error?: unknown }).error;
  return String(error);
};

describe("db persistence: failure mapping", () => {
  beforeAll(setupOxkv);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps a rejected save to a DbError failure", async () => {
    const failing = createDbPersistence("failure-test");
    vi.spyOn(dbStorage, "setItem").mockRejectedValue(
      new Error("quota exceeded"),
    );

    const exit = await Effect.runPromiseExit(
      failing.save("task", "id-1", { n: 1 }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(failureMessage(exit)).toContain("quota exceeded");
  });

  it("maps a rejected remove to a DbError failure", async () => {
    const failing = createDbPersistence("failure-test-remove");
    // The function `remove` returns false for a missing key.
    // The test must create the key first.
    await dbStorage.setItem(`failure-test-remove/task/id-2`, "{}");
    vi.spyOn(dbStorage, "removeItem").mockRejectedValue(
      new Error("idb unavailable"),
    );

    const exit = await Effect.runPromiseExit(failing.remove("task", "id-2"));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(failureMessage(exit)).toContain("idb unavailable");
  });

  it("returns false instead of failing when the row is already gone", async () => {
    const failing = createDbPersistence("failure-test-missing");

    await expect(run(failing.remove("task", "never-existed"))).resolves.toBe(
      false,
    );
  });

  it("maps a rejected load to a DbError failure", async () => {
    const failing = createDbPersistence("failure-test");
    vi.spyOn(dbStorage, "getKeys").mockRejectedValue(
      new Error("read denied"),
    );

    const exit = await Effect.runPromiseExit(failing.load("task"));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(failureMessage(exit)).toContain("read denied");
  });
});

describe("createPeerSync", () => {
  it("does nothing when BroadcastChannel is unavailable", () => {
    const original = globalThis.BroadcastChannel;
    // deno-lint-ignore no-explicit-any
    (globalThis as any).BroadcastChannel = undefined;

    try {
      const peers = createPeerSync("no-bc");
      expect(() => peers.publish({ kind: "delete", table: "t", id: "1" }))
        .not.toThrow();
      expect(typeof peers.subscribe(() => {})).toBe("function");
    } finally {
      globalThis.BroadcastChannel = original;
    }
  });

  it("sends one message to every subscriber", async () => {
    // BroadcastChannel does not send a message back to the object that posted it.
    // The test publishes from a second peer instance on the same root.
    const peers = createPeerSync("fanout-test");
    const sender = createPeerSync("fanout-test");
    const first: unknown[] = [];
    const second: unknown[] = [];

    peers.subscribe((e) => first.push(e));
    peers.subscribe((e) => second.push(e));

    sender.publish({ kind: "set", table: "task", id: "id-1", doc: { n: 1 } } as const);
    await flush();

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]).toMatchObject({ kind: "set", id: "id-1" });

    // The peer sync has no close function.
    // The channel stays alive for the lifetime of the module on purpose.
    // The worker has no teardown hook.
  });

  it("removes only the handler that unsubscribed", async () => {
    const peers = createPeerSync("detach-test");
    const sender = createPeerSync("detach-test");
    const kept: unknown[] = [];
    const dropped: unknown[] = [];

    const unsubscribeKept = peers.subscribe((e) => kept.push(e));
    peers.subscribe((e) => dropped.push(e));

    unsubscribeKept();
    sender.publish({ kind: "delete", table: "task", id: "id-2" } as const);
    await flush();

    expect(kept).toHaveLength(0);
    expect(dropped).toHaveLength(1);

    // The peer sync has no close function.
    // The channel stays alive for the lifetime of the module on purpose.
    // The worker has no teardown hook.
  });
});
