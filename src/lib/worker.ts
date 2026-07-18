import * as Comlink from "comlink";
import { Cause, Chunk, Effect, Stream } from "effect";

export type SyncRemoteProxy<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret ? (
      ...args: Args
    ) => Ret extends Effect.Effect<infer Success, any, any> ? Promise<Success> //  Effect function
      : Ret extends Stream.Stream<infer A, any, any>
        ? Promise<ReadableStream<A>> // Effect Stream as Web ReadableStream
      : Promise<Awaited<Ret>> //  regular sync or async function
    : T[K] extends object ? SyncRemoteProxy<T[K]>
    : Promise<T[K]>;
};

function flattenTaggedError(err: any): string {
  if (!err || typeof err !== "object") return String(err);

  const tags: string[] = [];
  let current = err;
  let message = "";

  // Travel down the nested error chain
  while (current && typeof current === "object") {
    if (current._tag) {
      tags.push(current._tag);
    }

    if (typeof current.error === "string") {
      message = current.error;
      break;
    } else if (current.message) {
      message = current.message;
      break;
    } else if (current.error && typeof current.error === "object") {
      current = current.error; // Move deeper down the rabbit hole
    } else {
      message = JSON.stringify(current);
      break;
    }
  }

  const tagPrefix = tags.length ? `[${tags.join(" -> ")}] ` : "";
  return `${tagPrefix}${message}`;
}

function formatEffectError(cause: Cause.Cause<unknown>): string {
  const failures = Chunk.toReadonlyArray(Cause.failures(cause));

  if (failures.length === 0) {
    return Cause.pretty(cause) || "An unexpected worker defect occurred.";
  }

  const topError = failures[0];
  return flattenTaggedError(topError);
}

if (!Comlink.transferHandlers.has("EFFECT_STREAM_PROXY")) {
  Comlink.transferHandlers.set("EFFECT_STREAM_PROXY", {
    canHandle: (val): val is Stream.Stream<any, any, any> =>
      val !== null &&
      (typeof val === "object" || typeof val === "function") &&
      Stream.StreamTypeId in val,

    serialize: <A, E>(streamInstance: Stream.Stream<A, E, never>) => {
      const { port1, port2 } = new MessageChannel();
      const iterator = Stream.toAsyncIterable(streamInstance)
        [Symbol.asyncIterator]();

      const remoteIterator = {
        async next() {
          try {
            return await iterator.next();
          } catch (err) {
            throw new Error(flattenTaggedError(err));
          }
        },
        async return() {
          if (typeof iterator.return === "function") await iterator.return();
          return { value: undefined, done: true };
        },
      };

      Comlink.expose(remoteIterator, port1);
      return [port2, [port2]];
    },
    deserialize: (port: MessagePort) => {
      const remoteIterator = Comlink.wrap<{
        next(): Promise<IteratorResult<any>>;
        return(): Promise<IteratorResult<any>>;
      }>(port);

      return new ReadableStream({
        async pull(controller) {
          try {
            const { value, done } = await remoteIterator.next();
            if (done) {
              controller.close();
              port.close();
            } else {
              controller.enqueue(value);
            }
          } catch (err) {
            controller.error(err);
            port.close();
          }
        },
        async cancel() {
          try {
            await remoteIterator.return();
          } catch (err) {
            console.error("Failed to cleanly cancel remote stream scope:", err);
          } finally {
            port.close();
          }
        },
      });
    },
  });
}

if (!Comlink.transferHandlers.has("EFFECT_PROXY")) {
  Comlink.transferHandlers.set("EFFECT_PROXY", {
    canHandle: (val): val is Effect.Effect<unknown, unknown, never> =>
      Effect.isEffect(val),

    serialize: <A, E>(effectInstance: Effect.Effect<A, E, never>) => {
      const { port1, port2 } = new MessageChannel();

      const executionPromise = () =>
        Effect.runPromise(
          effectInstance.pipe(
            Effect.matchCause({
              onFailure: (cause) => ({
                success: false,
                error: formatEffectError(cause),
              }),
              onSuccess: (value) => ({ success: true, value }),
            }),
          ),
        );

      Comlink.expose(executionPromise, port1);
      return [port2, [port2]];
    },

    deserialize: (port: MessagePort) => {
      const proxyFunc = Comlink.wrap<
        () => Promise<
          { success: true; value: any } | { success: false; error: string }
        >
      >(port);

      return (async () => {
        const result = await proxyFunc();
        if (!result.success) {
          throw new Error(`[Worker Error]\n${result.error}`);
        }
        return result.value;
      })();
    },
  });
}

if (!Comlink.transferHandlers.has("FUNCTION_PROXY")) {
  Comlink.transferHandlers.set("FUNCTION_PROXY", {
    canHandle: (val): val is Function => typeof val === "function",
    serialize: (val) => {
      const { port1, port2 } = new MessageChannel();
      Comlink.expose(val, port1);
      return [port2, [port2]];
    },
    deserialize: (port: MessagePort) => {
      return Comlink.wrap(port);
    },
  });
}
