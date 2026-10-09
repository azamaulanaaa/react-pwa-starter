import * as Comlink from "comlink";
import { Cause, Context, Effect, Queue, Stream } from "effect";
import { DevTools } from "effect/devtools";

export type ResolveEffect<T, Fallback> = T extends
  Effect.Effect<infer Success, unknown, unknown> ? Promise<Success>
  : T extends Stream.Stream<infer A, unknown, unknown>
    ? Promise<ReadableStream<A>>
  : Fallback;

export function flattenTaggedError(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const tags: string[] = [];
  let current: unknown = err;
  let message = "";

  while (current && typeof current === "object") {
    const obj = current as Record<string, unknown>;
    if (typeof obj._tag === "string") tags.push(obj._tag);
    if (typeof obj.error === "string") {
      message = obj.error;
      break;
    } else if (obj.message) {
      message = String(obj.message);
      break;
    } else if (obj.error && typeof obj.error === "object") {
      current = obj.error;
    } else {
      message = JSON.stringify(current);
      break;
    }
  }
  return tags.length ? `[${tags.join(" -> ")}] ${message}` : message;
}

/**
 * The devtools tracer is a layer, so the run path provides it. The build
 * defines `__DEVTOOLS__` as false for a production build, and the bundler
 * drops the layer and the import. The layer provides nothing, needs nothing,
 * and cannot fail.
 *
 * The tracer it installs is not scoped to the wrapped program. `Tracer` is a
 * `Context.Reference`, so it has a default that resolves outside the Context,
 * and `layerTracer` writes an explicit value for that key. Providing the layer
 * therefore replaces the tracer default for the whole worker, so any Effect
 * run after this one traces to devtools too, not just the wrapped program.
 */
function withDevTools<A, E, R>(
  program: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> {
  return __DEVTOOLS__
    ? program.pipe(Effect.provide(DevTools.layer()))
    : program;
}

export function formatEffectError(cause: Cause.Cause<unknown>): string {
  const failures = cause.reasons.filter(Cause.isFailReason);
  return failures.length === 0
    ? Cause.pretty(cause) || "An unexpected worker defect occurred."
    : flattenTaggedError(failures[0].error);
}

const NAME_STREAM = "EFFECT_STREAM_PROXY";
if (!Comlink.transferHandlers.has(NAME_STREAM)) {
  Comlink.transferHandlers.set(NAME_STREAM, {
    canHandle: (val): val is Stream.Stream<unknown, unknown, unknown> =>
      val !== null &&
      (typeof val === "object" || typeof val === "function") &&
      Stream.isStream(val),

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
        next(): Promise<IteratorResult<unknown>>;
        return(): Promise<IteratorResult<unknown>>;
      }>(port);

      // The remote end is a Comlink async iterator, not a local Stream. This
      // adapter reads the remote iterator outside the stream fiber and offers
      // each value to a queue. A pending remote read therefore never blocks
      // the fiber, so a cancel can interrupt the fiber at any time. The buffer
      // holds one value, so the reader still controls the request rate.
      const remoteStream = Stream.callback<unknown, Error>(
        (queue) => {
          let remoteFinished = false;

          const readRemote = async () => {
            try {
              while (true) {
                const { value, done } = await remoteIterator.next();
                if (done) break;
                await Effect.runPromise(Queue.offer(queue, value));
              }
              remoteFinished = true;
              await Effect.runPromise(Queue.end(queue));
            } catch (err) {
              remoteFinished = true;
              await Effect.runPromise(
                Queue.fail(queue, new Error(flattenTaggedError(err))),
              );
            }
          };
          void readRemote().catch(() => {
            // The queue is shut down. The reader stopped reading, so no error
            // is left to report.
          });

          // The finalizer runs on every terminal path: the end of the remote
          // data, a remote failure, and a cancel from the reader. It releases
          // the remote iterator on the cancel path and closes the port.
          return Effect.gen(function* () {
            yield* Effect.addFinalizer(() =>
              Effect.promise(() =>
                remoteFinished
                  ? Promise.resolve()
                  : remoteIterator.return().then(
                      () => undefined,
                      (err) => console.error("Stream cancel failed:", err),
                    ),
              ).pipe(Effect.andThen(Effect.sync(() => port.close()))),
            );
          });
        },
        { bufferSize: 1 },
      );

      return Stream.toReadableStream(remoteStream);
    },
  });
}

/**
 * The Context that transferred Effects run under. It is built once here, at
 * module scope, so every transferred Effect shares one runtime context
 * instead of each call making a fresh default one.
 *
 * It is empty on purpose. This is the single seam for worker-side services:
 * add a service to this Context and every transferred Effect can read it
 * without touching the run path again. An `HttpClient` for OTLP export is one
 * thing that would be added here.
 */
const effectProxyContext = Context.empty();

const NAME_EFFECT = "EFFECT_PROXY";
if (!Comlink.transferHandlers.has(NAME_EFFECT)) {
  Comlink.transferHandlers.set(NAME_EFFECT, {
    canHandle: (val): val is Effect.Effect<unknown, unknown, never> =>
      Effect.isEffect(val),
    serialize: <A, E>(effectInstance: Effect.Effect<A, E, never>) => {
      const { port1, port2 } = new MessageChannel();
      const executionPromise = () =>
        Effect.runPromiseWith(effectProxyContext)(
          withDevTools(
            effectInstance.pipe(
              Effect.matchCause({
                onFailure: (cause) => ({
                  success: false,
                  error: formatEffectError(cause),
                }),
                onSuccess: (value) => ({ success: true, value }),
              }),
            ),
          ),
        );
      Comlink.expose(executionPromise, port1);
      return [port2, [port2]];
    },
    deserialize: (port: MessagePort) => {
      // A structured clone of a v4 Effect does not throw. The clone is an
      // object that fails `Effect.isEffect`, and running it throws an error
      // with an undefined message. The check below rejects a result that
      // does not carry the envelope the worker sends, so a dead value never
      // reaches the caller as a success.
      const proxyFunc = Comlink.wrap<
        () => Promise<unknown>
      >(port);
      return (async () => {
        try {
          const result = await proxyFunc();
          if (
            result === null || typeof result !== "object" ||
            typeof (result as { success?: unknown }).success !== "boolean"
          ) {
            throw new Error(
              `[Worker Error]\nThe worker returned a value that is not an Effect result.`,
            );
          }
          if (!(result as { success: boolean }).success) {
            throw new Error(
              `[Worker Error]\n${
                String((result as { error?: unknown }).error)
              }`,
            );
          }
          return (result as { value: unknown }).value;
        } finally {
          port.close();
        }
      })();
    },
  });
}
