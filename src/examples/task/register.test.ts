import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { Effect } from "effect";
import { v7 as randomUUID } from "uuid";

import { taskTables } from "@/examples/task/register.ts";
import { createDatabase } from "@/worker/db/factory.ts";
import { setupOxkv } from "@/worker/db/oxkv-wasm.ts";

function run<A>(effect: Effect.Effect<A, unknown, never>): Promise<A> {
  return Effect.runPromise(effect);
}

describe("task table registration", () => {
  beforeAll(setupOxkv);

  it("creates the task table from the example table map", async () => {
    const db = createDatabase("task-registration", taskTables);
    const id = randomUUID();

    expect(Object.keys(db)).toEqual(["task"]);

    await run(
      db.task.set(id, {
        description: "Write the docs",
        is_done: false,
      }),
    );
    const row = await run(db.task.get(id));

    expect(row).toMatchObject({
      id,
      description: "Write the docs",
      is_done: false,
    });
  });
});
