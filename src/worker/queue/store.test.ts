import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import type { Job } from "@/worker/queue/schema.ts";
import { createStore, isTerminal } from "@/worker/queue/store.ts";

const run = <A>(effect: Effect.Effect<A, unknown, never>): Promise<A> =>
  Effect.runPromise(effect);

const record = (id: string, state: Job["state"]): Job => ({
  id,
  kind: "upload",
  payload: null,
  state,
  progress: 0,
  attempt: 1,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  result: null,
  error: null,
});

describe("store.firstQueued", () => {
  it("returns the oldest queued record and skips every other state", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "succeeded")));
    await run(store.put(record("b", "queued")));
    await run(store.put(record("c", "failed")));
    await run(store.put(record("d", "queued")));

    expect((await run(store.firstQueued()))?.id).toBe("b");
  });

  it("returns a record set after the previous call, in insertion order", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "queued")));

    expect((await run(store.firstQueued()))?.id).toBe("a");

    await run(store.put(record("b", "queued")));
    expect((await run(store.firstQueued()))?.id).toBe("a");

    await run(store.put(record("a", "succeeded")));
    expect((await run(store.firstQueued()))?.id).toBe("b");
  });
});

describe("store.list", () => {
  it("returns only the states in the filter", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "queued")));
    await run(store.put(record("b", "running")));
    await run(store.put(record("c", "succeeded")));

    expect((await run(store.list())).map((job) => job.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(
      (await run(store.list({ states: ["queued", "succeeded"] }))).map(
        (job) => job.id,
      ),
    ).toEqual(["a", "c"]);
    expect(await run(store.list({ states: ["canceled"] }))).toEqual([]);
  });

  it("counts the non-terminal records for admission", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "queued")));
    await run(store.put(record("b", "running")));
    await run(store.put(record("c", "failed")));

    expect(await run(store.liveCount())).toBe(2);
  });
});

describe("store ordering", () => {
  it("keeps the position of a replaced record", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "queued")));
    await run(store.put(record("b", "queued")));
    await run(store.put(record("c", "queued")));

    await run(store.put({ ...record("a", "running"), progress: 0.5 }));

    expect((await run(store.list())).map((job) => job.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("moves a record to the end on the delete-and-re-insert path", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "queued")));
    await run(store.put(record("b", "queued")));
    await run(store.put(record("c", "queued")));

    await run(store.requeue({ ...record("a", "queued") }));

    expect((await run(store.list())).map((job) => job.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("store.update", () => {
  it("applies the patch and keeps the record's position", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "queued")));
    await run(store.put(record("b", "queued")));

    const updated = await run(
      store.update("a", (job) => ({ ...job, state: "running" })),
    );

    expect(updated?.state).toBe("running");
    expect((await run(store.list())).map((job) => job.id)).toEqual(["a", "b"]);
  });

  it("refuses the patch and changes nothing when it returns null", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "queued")));

    const updated = await run(store.update("a", () => null));

    expect(updated).toBeNull();
    expect((await run(store.get("a")))?.state).toBe("queued");
  });

  it("reads a missing id as null and leaves the map alone", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "queued")));

    expect(await run(store.update("missing", (job) => job))).toBeNull();
    expect((await run(store.list())).map((job) => job.id)).toEqual(["a"]);
  });

  it("moves the record to the end when it requeues", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "queued")));
    await run(store.put(record("b", "queued")));
    await run(store.put(record("c", "queued")));

    await run(
      store.update("a", (job) => ({ ...job, state: "paused" }), {
        requeue: true,
      }),
    );

    expect((await run(store.list())).map((job) => job.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("keeps every write when fifty callers update at once", async () => {
    const store = await run(createStore());
    await run(store.put(record("a", "queued")));

    await run(
      Effect.all(
        Array.from({ length: 50 }, () =>
          store.update("a", (job) => ({ ...job, attempt: job.attempt + 1 }))
        ),
        { concurrency: "unbounded", discard: true },
      ),
    );

    // The read and the write are one atomic step, so no caller can read a
    // stale value and write it back. No operation awaits between the two
    // today, so this case states the contract rather than the cause.
    expect((await run(store.get("a")))?.attempt).toBe(51);
  });
});

describe("store", () => {
  it("reads a missing id as null and removes a record", async () => {
    const store = await run(createStore());
    expect(await run(store.get("missing"))).toBeNull();

    await run(store.put(record("a", "queued")));
    await run(store.remove("a"));
    expect(await run(store.get("a"))).toBeNull();

    expect(await run(store.list())).toEqual([]);
  });

  it("treats succeeded, failed, and canceled as terminal", () => {
    expect(isTerminal("succeeded")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("canceled")).toBe(true);
    expect(isTerminal("queued")).toBe(false);
    expect(isTerminal("running")).toBe(false);
    expect(isTerminal("paused")).toBe(false);
  });
});
