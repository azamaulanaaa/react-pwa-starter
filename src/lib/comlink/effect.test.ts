import { MessageChannel } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import { Cause, Effect, Stream } from "effect";
import * as Comlink from "comlink";

import { flattenTaggedError } from "@/lib/comlink/effect.ts";

/** Channels handed out to the tests, so every port is closed in afterEach. */
const channels: MessageChannel[] = [];
const newChannel = (): MessageChannel => {
  const channel = new MessageChannel();
  channels.push(channel);
  return channel;
};

afterEach(() => {
  for (const { port1, port2 } of channels.splice(0)) {
    port1.close();
    port2.close();
  }
});

describe("flattenTaggedError", () => {
  it("returns the string form of a primitive", () => {
    expect(flattenTaggedError("boom")).toBe("boom");
    expect(flattenTaggedError(42)).toBe("42");
    expect(flattenTaggedError(null)).toBe("null");
    expect(flattenTaggedError(undefined)).toBe("undefined");
  });

  it("collects the tag chain and message of a tagged error", () => {
    expect(flattenTaggedError({ _tag: "Failure", error: "nope" })).toBe(
      "[Failure] nope",
    );
  });

  it("joins a nested tag chain", () => {
    const err = { _tag: "Outer", error: { _tag: "Inner", error: "deep" } };

    expect(flattenTaggedError(err)).toBe("[Outer -> Inner] deep");
  });

  it("prefers the string error field over message", () => {
    expect(flattenTaggedError({ error: "from error", message: "from message" }))
      .toBe("from error");
  });

  it("falls back to message when there is no error field", () => {
    expect(flattenTaggedError(new Error("kaboom"))).toBe("kaboom");
  });

  it("stringifies an error-shaped object it cannot unwrap", () => {
    expect(flattenTaggedError({ unexpected: true })).toBe(
      '{"unexpected":true}',
    );
  });
});

describe("EFFECT_PROXY transfer handler", () => {
  it("resolves a successful Effect across the comlink boundary", async () => {
    const { port1, port2 } = newChannel();
    Comlink.expose(
      { double: (n: number): Effect.Effect<number> => Effect.succeed(n * 2) },
      port1 as unknown as Comlink.Endpoint,
    );
    const remote = Comlink.wrap<{
      double(n: number): Promise<number>;
    }>(port2 as unknown as Comlink.Endpoint);

    await expect(remote.double(21)).resolves.toBe(42);
  });

  it("rejects with a [Worker Error] message when the Effect fails", async () => {
    const { port1, port2 } = newChannel();
    Comlink.expose(
      {
        boom: (): Effect.Effect<never> =>
          Effect.fail(new Error("worker exploded")) as Effect.Effect<never>,
      },
      port1 as unknown as Comlink.Endpoint,
    );
    const remote = Comlink.wrap<{ boom(): Promise<never> }>(
      port2 as unknown as Comlink.Endpoint,
    );

    await expect(remote.boom()).rejects.toThrow(/\[Worker Error\]/);
    await expect(remote.boom()).rejects.toThrow(/worker exploded/);
  });

  it("preserves a defect as a worker error rather than swallowing it", async () => {
    const { port1, port2 } = newChannel();
    Comlink.expose(
      {
        defect: (): Effect.Effect<never> =>
          Effect.die(new Error("hard defect")) as Effect.Effect<never>,
      },
      port1 as unknown as Comlink.Endpoint,
    );
    const remote = Comlink.wrap<{ defect(): Promise<never> }>(
      port2 as unknown as Comlink.Endpoint,
    );

    await expect(remote.defect()).rejects.toThrow(/\[Worker Error\]/);
  });
});

describe("EFFECT_STREAM_PROXY transfer handler", () => {
  it("streams values across the boundary and closes", async () => {
    const { port1, port2 } = newChannel();
    Comlink.expose(
      {
        numbers: (): Stream.Stream<number> => Stream.make(1, 2, 3),
      },
      port1 as unknown as Comlink.Endpoint,
    );
    const remote = Comlink.wrap<{ numbers(): Promise<ReadableStream<number>> }>(
      port2 as unknown as Comlink.Endpoint,
    );

    const stream = await remote.numbers();
    const seen: number[] = [];
    for await (const value of stream) seen.push(value);

    expect(seen).toEqual([1, 2, 3]);
  });

  it("errors the readable stream when the underlying stream fails", async () => {
    const { port1, port2 } = newChannel();
    Comlink.expose(
      {
        failing: (): Stream.Stream<number, Error> => Stream.fail(new Error("nope")),
      },
      port1 as unknown as Comlink.Endpoint,
    );
    const remote = Comlink.wrap<{
      failing(): Promise<ReadableStream<number>>;
    }>(port2 as unknown as Comlink.Endpoint);

    const reader = (await remote.failing()).getReader();

    await expect(reader.read()).rejects.toThrow();
  });

  it("flattens a tagged stream failure into the stream error", async () => {
    const { port1, port2 } = newChannel();
    const failing = Stream.concat(
      Stream.make(1),
      Stream.fail({ _tag: "StreamFailure", error: "mid-stream boom" }),
    );
    Comlink.expose(
      { failing: (): Stream.Stream<number, unknown> => failing },
      port1 as unknown as Comlink.Endpoint,
    );
    const remote = Comlink.wrap<{
      failing(): Promise<ReadableStream<number>>;
    }>(port2 as unknown as Comlink.Endpoint);

    const reader = (await remote.failing()).getReader();
    await reader.read();

    await expect(reader.read()).rejects.toThrow(/mid-stream boom/);
  });
});

describe("formatEffectError integration", () => {
  it("renders a failure cause produced through the same path as the handler", () => {
    const cause = Cause.fail({ _tag: "FsError", error: "no session" });
    const failures = Cause.failures(cause);
    const first = Array.from(failures)[0];

    expect(flattenTaggedError(first)).toContain("no session");
  });
});