import { MessageChannel, MessagePort } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import { Cause, Effect, Stream } from "effect";
import * as Comlink from "comlink";

import { flattenTaggedError } from "@/lib/comlink/effect.ts";

/** The tests receive these channels. The `afterEach` hook closes every port. */
const channels: MessageChannel[] = [];
const newChannel = (): MessageChannel => {
  const channel = new MessageChannel();
  channels.push(channel);
  return channel;
};

/** The first message the port receives, as the receiver sees it. */
const nextMessage = <T>(port: MessagePort): Promise<T> =>
  new Promise((resolve) => port.once("message", resolve));

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
    expect(
      flattenTaggedError({ error: "from error", message: "from message" }),
    ).toBe("from error");
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

    await expect(remote.boom()).rejects.toThrow(
      /\[Worker Error\]\nworker exploded/,
    );
    await expect(remote.boom()).rejects.toThrow(/worker exploded/);
  });

  it("reports a defect as a worker error instead of dropping it", async () => {
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

    // A defect carries no failure reason, so the guard writes the pretty
    // cause here. The body names the defect, which is what tells this branch
    // apart from the branch for a result that is not an Effect result.
    await expect(remote.defect()).rejects.toThrow(
      /\[Worker Error\]\nError: hard defect/,
    );
  });
});

describe("EFFECT_PROXY deserialize guard", () => {
  // A structured clone of a v4 Effect does not throw. It arrives as an object
  // that fails `Effect.isEffect`. Each test below exposes a non-envelope value
  // on one end of a real channel and hands the other end to the registered
  // deserialize handler, which must reject it.

  // The message the guard writes for a result that is not an Effect result.
  // The body names the case, so the assertion pins which branch produced the
  // error instead of matching any Error that carries the prefix.
  const NOT_AN_EFFECT_RESULT =
    /\[Worker Error\]\nThe worker returned a value that is not an Effect result\./;

  /** The registered handler, fetched the way `deserializeResult` fetches it. */
  const handlerOf = () => {
    const handler = Comlink.transferHandlers.get("EFFECT_PROXY");
    if (!handler) throw new Error("EFFECT_PROXY handler is not registered");
    return handler;
  };

  const deserializeResult = (remote: unknown): Promise<unknown> => {
    const { port1, port2 } = newChannel();
    Comlink.expose(() => remote, port1 as unknown as Comlink.Endpoint);
    // The handler returns the promise from its async body; the transfer
    // handler type widens it to the Effect it stands in for.
    return handlerOf().deserialize(
      port2 as unknown as MessagePort,
    ) as unknown as Promise<unknown>;
  };

  it("rejects the structured clone of a real Effect", async () => {
    // This is the input the guard exists for. A v4 Effect clones without
    // throwing: the clone arrives as a plain Object whose only own key is
    // `~effect/Effect/args`, holding the args tuple. It fails
    // `Effect.isEffect`, and running it throws "Fiber.runLoop: Not a valid
    // effect: [object Object]" with an undefined message. Nothing in the
    // clone marks it as dead, so the guard has to reject on shape alone.
    const { port1, port2 } = newChannel();
    port1.postMessage(Effect.succeed(42));
    const clone = await nextMessage<Record<string, unknown>>(port2);

    expect(Effect.isEffect(clone)).toBe(false);
    expect(Reflect.ownKeys(clone)).toEqual(["~effect/Effect/args"]);
    expect((clone as { success?: unknown }).success).toBeUndefined();

    // Hand the clone to the handler over a channel of its own, the way a
    // comlink reply would carry it.
    await expect(deserializeResult(clone)).rejects.toThrow(
      NOT_AN_EFFECT_RESULT,
    );
  });

  it("rejects when the remote throws", async () => {
    // The remote function rejects, so the await inside the deserialize body
    // rejects. The body has no catch, so the rejection reaches the caller
    // unchanged. The handler must not swallow it or turn it into a result.
    const { port1, port2 } = newChannel();
    Comlink.expose(
      (): never => {
        throw new Error("the remote exploded");
      },
      port1 as unknown as Comlink.Endpoint,
    );

    const handler = handlerOf();
    const promise = handler.deserialize(
      port2 as unknown as MessagePort,
    ) as unknown as Promise<unknown>;
    const settled = promise.then(
      (value) => ({ state: "resolved" as const, value }),
      (error: Error) => ({
        state: "rejected" as const,
        message: error.message,
      }),
    );

    // It rejects rather than resolving, and it rejects with what the remote
    // threw. The guard never runs, so no [Worker Error] reaches the caller.
    expect(await settled).toEqual({
      state: "rejected",
      message: "the remote exploded",
    });
  });

  it("closes the port after the deserialize settles", async () => {
    const { port1, port2 } = newChannel();
    let calls = 0;
    Comlink.expose(
      (): { success: boolean; value: number } => {
        calls += 1;
        return { success: true, value: 42 };
      },
      port1 as unknown as Comlink.Endpoint,
    );

    const handler = handlerOf();
    await expect(
      handler.deserialize(port2 as unknown as MessagePort),
    ).resolves.toBe(42);
    expect(calls).toBe(1);

    // The body closes the port in a finally. A closed MessagePort does not
    // throw on a later post, it drops it, so the test calls the same function
    // again and waits for an answer that cannot arrive.
    const remote = Comlink.wrap<() => Promise<number>>(
      port2 as unknown as Comlink.Endpoint,
    );
    const answer = await Promise.race([
      remote().then(
        () => "answered",
        () => "answered",
      ),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("silent"), 50);
      }),
    ]);

    expect(answer).toBe("silent");
    expect(calls).toBe(1);
  });

  it("rejects a result with no success field", async () => {
    await expect(deserializeResult({ value: 42 })).rejects.toThrow(
      NOT_AN_EFFECT_RESULT,
    );
  });

  it("rejects a null result", async () => {
    await expect(deserializeResult(null)).rejects.toThrow(NOT_AN_EFFECT_RESULT);
  });

  it("rejects a primitive result", async () => {
    await expect(deserializeResult("not an Effect result")).rejects.toThrow(
      NOT_AN_EFFECT_RESULT,
    );
  });

  it("rejects a success field that is not a boolean", async () => {
    await expect(
      deserializeResult({ success: "yes", value: 42 }),
    ).rejects.toThrow(NOT_AN_EFFECT_RESULT);
  });

  it("resolves the value of a well formed success envelope", async () => {
    await expect(deserializeResult({ success: true, value: 42 })).resolves.toBe(
      42,
    );
  });
});

describe("plain value transfer", () => {
  it("passes a plain object through the port", async () => {
    const { port1, port2 } = newChannel();
    Comlink.expose(
      {
        read: (): { count: number; label: string } => ({
          count: 2,
          label: "usable",
        }),
      },
      port1 as unknown as Comlink.Endpoint,
    );
    const remote = Comlink.wrap<{
      read(): Promise<{ count: number; label: string }>;
    }>(port2 as unknown as Comlink.Endpoint);

    const value = await remote.read();

    expect(value).toEqual({ count: 2, label: "usable" });
    // A dead clone cannot be used. The test writes to the value, so the
    // remote side holds a live object.
    value.count += 1;
    expect(value.count).toBe(3);
  });

  it("passes an array through the port", async () => {
    const { port1, port2 } = newChannel();
    Comlink.expose(
      { read: (): string[] => ["first", "second"] },
      port1 as unknown as Comlink.Endpoint,
    );
    const remote = Comlink.wrap<{ read(): Promise<string[]> }>(
      port2 as unknown as Comlink.Endpoint,
    );

    const value = await remote.read();

    expect(value).toEqual(["first", "second"]);
    value.push("third");
    expect(value).toEqual(["first", "second", "third"]);
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
        failing: (): Stream.Stream<number, Error> =>
          Stream.fail(new Error("nope")),
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
    const failures = cause.reasons.filter(Cause.isFailReason);
    const first = failures[0];

    expect(flattenTaggedError(first.error)).toContain("no session");
  });
});
