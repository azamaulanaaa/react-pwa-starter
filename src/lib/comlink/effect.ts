import * as Comlink from "comlink";
import { Cause, Chunk, Effect, Stream } from "effect";

export type ResolveEffect<T, Fallback> = T extends
  Effect.Effect<infer Success, any, any> ? Promise<Success>
  : T extends Stream.Stream<infer A, any, any> ? Promise<ReadableStream<A>>
  : Fallback;

export function flattenTaggedError(err: any): string {
  if (!err || typeof err !== "object") return String(err);
  const tags: string[] = [];
  let current = err;
  let message = "";

  while (current && typeof current === "object") {
    if (current._tag) tags.push(current._tag);
    if (typeof current.error === "string") {
      message = current.error;
      break;
    } else if (current.message) {
      message = current.message;
      break;
    } else if (current.error && typeof current.error === "object") {
      current = current.error;
    } else {
      message = JSON.stringify(current);
      break;
    }
  }
  return tags.length ? `[${tags.join(" -> ")}] ${message}` : message;
}

function formatEffectError(cause: Cause.Cause<unknown>): string {
  const failures = Chunk.toReadonlyArray(Cause.failures(cause));
  return failures.length === 0
    ? Cause.pretty(cause) || "An unexpected worker defect occurred."
    : flattenTaggedError(failures[0]);
}

const NAME_STREAM = "EFFECT_STREAM_PROXY";
if (!Comlink.transferHandlers.has(NAME_STREAM)) {
  Comlink.transferHandlers.set(NAME_STREAM, {
    canHandle: (val): val is Stream.Stream<any, any, any> =>
      val !== null && (typeof val === "object" || typeof val === "function") &&
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
          } catch (e) {
            console.error("Stream cancel failed:", e);
          } finally {
            port.close();
          }
        },
      });
    },
  });
}

const NAME_EFFECT = "EFFECT_PROXY";
if (!Comlink.transferHandlers.has(NAME_EFFECT)) {
  Comlink.transferHandlers.set(NAME_EFFECT, {
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
        try {
          const result = await proxyFunc();
          if (!result.success) {
            throw new Error(`[Worker Error]\n${result.error}`);
          }
          return result.value;
        } finally {
          port.close();
        }
      })();
    },
  });
}
