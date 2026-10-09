import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import { QueueError } from "@/worker/queue/error.ts";
import { createRegistry } from "@/worker/queue/registry.ts";
import type { JobHandler } from "@/worker/queue/schema.ts";

const run = <A>(effect: Effect.Effect<A, unknown, never>): Promise<A> =>
  Effect.runPromise(effect);

const ok: JobHandler = () => Effect.succeed("ok");
const other: JobHandler = () => Effect.succeed("other");

describe("registry", () => {
  it("resolves a registered kind to its handler", async () => {
    const registry = await run(createRegistry());
    await run(registry.register("upload", ok));

    const handler = await run(registry.lookup("upload"));
    expect(await run(handler({} as never))).toBe("ok");
  });

  it("fails an unregistered kind with unknown_kind and the kind in the message", async () => {
    const registry = await run(createRegistry());
    const error = await run(registry.lookup("upload")).catch((e) => e);

    expect(error).toBeInstanceOf(QueueError);
    expect((error as QueueError).reason).toBe("unknown_kind");
    expect((error as QueueError)._tag).toBe("app/worker/queue");
    expect(String((error as QueueError).error)).toContain("upload");
  });

  it("replaces the handler when a kind is registered again", async () => {
    const registry = await run(createRegistry());
    await run(registry.register("upload", ok));
    await run(registry.register("upload", other));

    const handler = await run(registry.lookup("upload"));
    expect(await run(handler({} as never))).toBe("other");
    expect(await run(registry.kinds())).toEqual(["upload"]);
  });
});
