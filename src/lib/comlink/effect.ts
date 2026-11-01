import * as Comlink from "comlink";
import { Cause, Context, Effect, Queue, Stream } from "effect";
import { DevTools } from "effect/devtools";

export type ResolveEffect<T, Fallback> =
  T extends Effect.Effect<infer Success, unknown, unknown>
    ? Promise<Success>
    : T extends Stream.Stream<infer A, unknown, unknown>
      ? Promise<ReadableStream<A>>
      : Fallback;

/** The tag chain of a nested error. The chain is outermost first. */
export type WorkerErrorDetails = {
  tags: string[];
};

/**
 * The error payload that crosses the worker bridge.
 * The tag is the outermost tag. The value is null when the error has no tag.
 * The message is the old text form, so an existing caller sees the same text.
 */
export type WorkerErrorPayload = {
  tag: string | null;
  message: string;
  details?: WorkerErrorDetails;
};

/** A tagged error can be nested below another error in the chain. */
function isTaggedError(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { _tag?: unknown })._tag === "string"
  );
}

/**
 * Reads the tag chain and the message from an error.
 * The function reads the tag from the `_tag` field.
 * The function does not parse the tag from the message text.
 * The function returns a null tag for an error that has no tag.
 */
export function flattenTaggedError(err: unknown): WorkerErrorPayload {
  if (!err || typeof err !== "object") {
    return { tag: null, message: String(err) };
  }
  const tags: string[] = [];
  let current: unknown = err;
  let message = "";

  while (current && typeof current === "object") {
    const obj = current as Record<string, unknown>;
    if (typeof obj._tag === "string") tags.push(obj._tag);

    // A nested tagged error keeps its place in the chain. The outer error can
    // also carry a message, so the walk reads the nested tag first.
    if (isTaggedError(obj.error)) {
      current = obj.error;
      continue;
    }
    if (typeof obj.error === "string") {
      message = obj.error;
      break;
    }
    if (typeof obj.message === "string" && obj.message !== "") {
      message = obj.message;
      break;
    }
    if (obj.error && typeof obj.error === "object") {
      current = obj.error;
      continue;
    }
    message = JSON.stringify(current);
    break;
  }

  const payload: WorkerErrorPayload = {
    tag: tags[0] ?? null,
    message: tags.length ? `[${tags.join(" -> ")}] ${message}` : message,
  };
  if (tags.length > 1) payload.details = { tags };
  return payload;
}

/**
 * Rebuilds the error that the UI receives from a worker payload.
 * The function reads the tag from the payload `tag` field.
 * The function never reads the tag from the message text.
 * An old string payload maps to a null tag for one release.
 */
export function workerErrorFromPayload(payload: unknown): WorkerError {
  if (typeof payload === "string") {
    return new WorkerError({ tag: null, message: payload });
  }
  if (payload !== null && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const tag = typeof record.tag === "string" ? record.tag : null;
    const message =
      typeof record.message === "string" ? record.message : String(payload);
    const details = readDetails(record.details);
    return new WorkerError(
      details === undefined ? { tag, message } : { tag, message, details },
    );
  }
  return new WorkerError({ tag: null, message: String(payload) });
}

/** Reads the nested tag chain from an untrusted details value. */
function readDetails(value: unknown): WorkerErrorDetails | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const tags = (value as { tags?: unknown }).tags;
  if (!Array.isArray(tags)) return undefined;
  if (!tags.every((tag) => typeof tag === "string")) return undefined;
  return { tags };
}

/** The error that the UI receives from a failed worker call. */
export class WorkerError extends Error {
  /** The outermost worker error tag. The value is null when there is no tag. */
  readonly tag: string | null;

  /** The tag chain of a nested error. The field is absent for one tag. */
  readonly details?: WorkerErrorDetails;

  /**
   * Builds a worker error.
   * The message keeps the old two-line text for an existing caller.
   */
  constructor(payload: WorkerErrorPayload) {
    super(`[Worker Error]\n${payload.message}`);
    this.name = "WorkerError";
    this.tag = payload.tag;
    if (payload.details !== undefined) this.details = payload.details;
  }
}

export function formatEffectError(
  cause: Cause.Cause<unknown>,
): WorkerErrorPayload {
  const failures = cause.reasons.filter(Cause.isFailReason);
  return failures.length === 0
    ? {
        tag: null,
        message: Cause.pretty(cause) || "An unexpected worker defect occurred.",
      }
    : flattenTaggedError(failures[0].error);
}

/**
 * The devtools tracer is a layer, so the run path provides it. The build
 * defines `__DEVTOOLS__` as false for a production build, and the bundler
 * drops the layer and the import. The layer provides nothing, needs nothing,
 * and cannot fail.
 *
 * `Effect.provide` builds the layer in a scope and merges its Context into the
 * program it is applied to, so this tracer reaches that Effect and any fiber
 * forked beneath it. It does not change the default tracer, so Effects started
 * separately, for example the ones in the stream bridge below, keep the
 * default.
 */
function withDevTools<A, E, R>(
  program: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> {
  return __DEVTOOLS__
    ? program.pipe(Effect.provide(DevTools.layer()))
    : program;
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
      const iterator =
        Stream.toAsyncIterable(streamInstance)[Symbol.asyncIterator]();
      let failure: WorkerErrorPayload | undefined;

      const remoteIterator = {
        async next() {
          try {
            failure = undefined;
            return await iterator.next();
          } catch (err) {
            // Comlink copies only message, name, and stack from a thrown
            // Error. The `failure` method sends the payload as a value, so
            // the tag survives the port.
            failure = flattenTaggedError(err);
            throw new WorkerError(failure);
          }
        },
        async return() {
          if (typeof iterator.return === "function") await iterator.return();
          return { value: undefined, done: true };
        },
        failure() {
          return failure;
        },
      };

      Comlink.expose(remoteIterator, port1);
      return [port2, [port2]];
    },

    deserialize: (port: MessagePort) => {
      const remoteIterator = Comlink.wrap<{
        next(): Promise<IteratorResult<unknown>>;
        return(): Promise<IteratorResult<unknown>>;
        failure(): Promise<WorkerErrorPayload | undefined>;
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
              // Read the payload that the worker kept beside the thrown
              // error. The thrown error lost the tag at the port.
              const payload = await remoteIterator
                .failure()
                .catch(() => undefined);
              await Effect.runPromise(
                Queue.fail(
                  queue,
                  new WorkerError(
                    payload === undefined ? flattenTaggedError(err) : payload,
                  ),
                ),
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
      const proxyFunc = Comlink.wrap<() => Promise<unknown>>(port);
      return (async () => {
        try {
          const result = await proxyFunc();
          if (
            result === null ||
            typeof result !== "object" ||
            typeof (result as { success?: unknown }).success !== "boolean"
          ) {
            throw new WorkerError({
              tag: null,
              message:
                "The worker returned a value that is not an Effect result.",
            });
          }
          if (!(result as { success: boolean }).success) {
            throw workerErrorFromPayload((result as { error?: unknown }).error);
          }
          return (result as { value: unknown }).value;
        } finally {
          port.close();
        }
      })();
    },
  });
}
