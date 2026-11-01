import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  FiberMap,
  Option,
  Queue,
  Ref,
  Result,
  Scope,
  Semaphore,
  Stream,
} from "effect";
import { v7 as randomUUID } from "uuid";

import { flattenTaggedError } from "@/lib/comlink/effect.ts";
import { type QueueError, queueError } from "@/worker/queue/error.ts";
import { decodeUnknownFx, nowIso } from "@/worker/queue/helpers.ts";
import { createRegistry, type JobRegistry } from "@/worker/queue/registry.ts";
import {
  type EnqueueInput,
  EnqueueInputSchema,
  type Job,
  type JobContext,
  type JobId,
  JobIdSchema,
  type ListFilter,
  ListFilterSchema,
  type QueueConfig,
  resolveConfig,
  type WaitOptions,
  WaitOptionsSchema,
} from "@/worker/queue/schema.ts";
import {
  createStore,
  isTerminal,
  type JobStore,
} from "@/worker/queue/store.ts";
import { createWatchBus, watchStream } from "@/worker/queue/watch.ts";

export type QueueApi = {
  readonly enqueue: (
    input: EnqueueInput,
  ) => Effect.Effect<Job, QueueError, never>;
  readonly get: (id: string) => Effect.Effect<Job | null, QueueError, never>;
  readonly list: (
    filter?: ListFilter,
  ) => Effect.Effect<Job[], QueueError, never>;
  readonly pause: (id: string) => Effect.Effect<boolean, QueueError, never>;
  readonly resume: (id: string) => Effect.Effect<boolean, QueueError, never>;
  readonly cancel: (id: string) => Effect.Effect<boolean, QueueError, never>;
  readonly wait: (
    id: string,
    options?: WaitOptions,
  ) => Effect.Effect<Job, QueueError, never>;
  readonly watch: (
    filter?: ListFilter,
  ) => Stream.Stream<Job[], QueueError, never>;
};

// The registry hangs off the runtime, not off `QueueApi`, so it never crosses
// the port. `register` is worker-side only.
export type QueueRuntime = QueueApi & {
  readonly registry: JobRegistry;
};

// The error channel is `QueueError`, not `never`, because the two persistence
// hooks in `src/worker/queue/store.ts` can fail. Both default to an inert
// implementation, so a build of this runtime cannot fail today.
export const createQueue = (
  config?: Partial<QueueConfig>,
): Effect.Effect<QueueRuntime, QueueError, Scope.Scope> =>
  Effect.gen(function* () {
    const resolved = resolveConfig(config);
    const registry = yield* createRegistry();
    const store: JobStore = yield* createStore();
    const scope = yield* Scope.Scope;

    // The wake-up signal holds no job id, so a paused or canceled job leaves
    // nothing behind in a buffer.
    const wakeup = yield* Queue.unbounded<undefined>();
    const permits = yield* Semaphore.make(resolved.concurrency);
    const fibers = yield* FiberMap.make<JobId>();
    const waiters = yield* Ref.make(new Map<JobId, Deferred.Deferred<Job>>());

    const loaded = yield* store.load();
    yield* Effect.forEach(loaded, (job) => store.put(job), { discard: true });

    const bus = createWatchBus(store);

    /**
     * The single writer. Every state change in the system goes through it: it
     * reads the record, refuses a gone or terminal one, applies the patch,
     * stamps `updated_at`, writes the map, persists, signals the loop,
     * completes the waiters, and publishes to the bus.
     */
    const transition = (
      id: JobId,
      patch: Partial<Job>,
      options?: { readonly requeue?: boolean },
    ): Effect.Effect<boolean, QueueError> =>
      Effect.gen(function* () {
        // One atomic read-modify-write. A pause and a cancel can arrive on
        // two callers at once. A separate read and write would let the slower
        // caller restore its stale state over the state the faster caller
        // already wrote.
        const next = yield* store.update(
          id,
          // Terminal states are final. Nothing reopens them.
          (current) =>
            isTerminal(current.state)
              ? null
              : { ...current, ...patch, updated_at: nowIso() },
          options,
        );
        if (next === null) return false;

        yield* store.persist(next);

        // The map is written first, the loop is signalled second, and the bus
        // is published last. The loop only re-reads after a signal, so it can
        // only ever see post-mutation state.
        yield* Queue.offer(wakeup, undefined);

        if (isTerminal(next.state)) {
          const waiter = yield* Ref.modify(waiters, (map) => {
            const deferred = map.get(id);
            if (deferred === undefined) return [undefined, map] as const;
            const nextMap = new Map(map);
            nextMap.delete(id);
            return [deferred, nextMap] as const;
          });
          if (waiter !== undefined) yield* Deferred.succeed(waiter, next);
        }

        yield* bus.publish();
        return true;
      });

    /** A report outside `running` is dropped, and the handler learns it. */
    const report = (
      id: JobId,
      fraction: number,
    ): Effect.Effect<boolean, QueueError> =>
      Effect.gen(function* () {
        const current = yield* store.get(id);
        if (current === null || current.state !== "running") return false;
        return yield* transition(id, { progress: fraction });
      });

    const interrupt = (id: JobId): Effect.Effect<void> =>
      Effect.gen(function* () {
        const fiber = yield* FiberMap.get(fibers, id);
        if (Option.isSome(fiber)) yield* Fiber.interrupt(fiber.value);
      });

    const finalizeExit = (
      id: JobId,
      exit: Exit.Exit<unknown, QueueError>,
    ): Effect.Effect<void, QueueError> =>
      Effect.gen(function* () {
        const job = yield* store.get(id);
        // Only the run the record still names may finalize it. A pause or a
        // cancel wrote the state first. The interrupt arrives because of that
        // decision. The job did not fail.
        if (job === null || job.state !== "running") return;

        // A resume can arrive while `pause` still waits for the interrupt to
        // finish. The loop then starts a new run under the same id while this
        // fiber is still unwinding. This fiber no longer owns the record, so it
        // must not write a result for the run that replaced it. The map entry
        // is missing when the scope closes, and a missing entry does not mean
        // a different owner.
        const self = Fiber.getCurrent();
        const owner = yield* FiberMap.get(fibers, id);
        if (
          self !== undefined &&
          Option.isSome(owner) &&
          owner.value.id !== self.id
        ) {
          return;
        }

        if (Exit.isSuccess(exit)) {
          yield* transition(id, {
            state: "succeeded",
            progress: 1,
            result: exit.value,
            error: null,
          });
          return;
        }

        // `flattenTaggedError` returns the old `[tag] message` text, so the
        // record is exactly the text the UI would have received.
        const failure = Cause.findFail(exit.cause);
        yield* transition(id, {
          state: "failed",
          error: Result.isSuccess(failure)
            ? flattenTaggedError(failure.success.error).message
            : Cause.pretty(exit.cause),
        });
      });

    // The controller is built when the effect is built and closed when that
    // effect ends, so the signal is aborted on every terminal path.
    const runJob = (id: JobId): Effect.Effect<void, QueueError> => {
      const controller = new AbortController();

      return Effect.gen(function* () {
        const job = yield* store.get(id);
        if (job === null) return;

        const handler = yield* registry.lookup(job.kind).pipe(Effect.option);

        if (Option.isNone(handler)) {
          yield* transition(id, {
            state: "failed",
            error: `No handler is registered for kind '${job.kind}'.`,
          });
          return;
        }

        const ctx: JobContext = {
          id: job.id,
          kind: job.kind,
          payload: job.payload,
          attempt: job.attempt,
          signal: controller.signal,
          progress: (fraction) => report(id, fraction),
        };

        const exit = yield* Effect.exit(handler.value(ctx));

        // The interruption of a pause or a cancel never reaches this line, so
        // only an untouched fiber is completed here.
        yield* Effect.suspend(() => finalizeExit(id, exit));
      }).pipe(Effect.ensuring(Effect.sync(() => controller.abort())));
    };

    const loop = Effect.gen(function* () {
      while (true) {
        yield* Queue.take(wakeup);

        const next = yield* store.firstQueued();
        if (next === null) continue;

        // The permit is taken only after a job is found, so the loop never
        // holds one while it is idle.
        yield* Semaphore.take(permits, 1);

        // The job may have been paused or canceled between the scan and here.
        const current = yield* store.get(next.id);
        if (current === null || current.state !== "queued") {
          yield* Semaphore.release(permits, 1);
          continue;
        }

        const started = yield* transition(current.id, {
          state: "running",
          progress: 0,
        });
        // The loop runs at most `concurrency` jobs at once. Every path that
        // does not start a run must return its permit. A permit that is never
        // returned stops one more job from ever starting. It blocks the queue
        // until the worker closes.
        if (!started) {
          yield* Semaphore.release(permits, 1);
          continue;
        }

        // `startImmediately: false` installs the map entry before the handler
        // runs. A job whose first act resumes another fiber, such as a
        // `Deferred` a test awaits, would otherwise be cancellable only after
        // its own fiber had already run past the first suspension point.
        yield* FiberMap.run(
          fibers,
          current.id,
          runJob(current.id).pipe(
            Effect.ensuring(
              Effect.flatMap(Semaphore.release(permits, 1), () =>
                store.touch(current.id),
              ),
            ),
          ),
          { startImmediately: false },
        );
      }
    });

    yield* Effect.forkIn(loop, scope);

    const read = (
      id: JobId,
      allowed: readonly Job["state"][],
    ): Effect.Effect<Job | null> =>
      Effect.gen(function* () {
        const job = yield* store.get(id);
        if (job === null || !allowed.includes(job.state)) return null;
        return job;
      });

    const api: QueueRuntime = {
      registry,

      enqueue: (input) =>
        Effect.gen(function* () {
          const decoded = yield* decodeUnknownFx(EnqueueInputSchema, input);

          // An unregistered kind fails immediately rather than queueing into
          // a guaranteed failure.
          yield* registry.lookup(decoded.kind);

          // Admission control counts the live records. Nothing is dropped.
          const live = yield* store.liveCount();
          if (live >= resolved.capacity) {
            return yield* queueError(
              "queue_full",
              `The queue already holds ${resolved.capacity} live jobs.`,
            );
          }

          const now = nowIso();
          const job: Job = {
            id: randomUUID(),
            kind: decoded.kind,
            payload: decoded.payload ?? null,
            state: "queued",
            progress: 0,
            attempt: 1,
            created_at: now,
            updated_at: now,
            result: null,
            error: null,
          };

          yield* store.put(job);
          yield* store.persist(job);
          yield* Queue.offer(wakeup, undefined);
          yield* bus.publish();
          return job;
        }),

      get: (id) =>
        Effect.gen(function* () {
          const jobId = yield* decodeUnknownFx(JobIdSchema, id);
          return yield* store.get(jobId);
        }),

      list: (filter) =>
        Effect.gen(function* () {
          const decoded = yield* decodeUnknownFx(
            ListFilterSchema,
            filter ?? {},
          );
          return yield* store.list(decoded);
        }),

      pause: (id) =>
        Effect.gen(function* () {
          const jobId = yield* decodeUnknownFx(JobIdSchema, id);
          const job = yield* read(jobId, ["queued", "running"]);
          if (job === null) return false;

          // The state is written before the interrupt, so the job's finalizer
          // sees `paused` and records no failure.
          const moved = yield* transition(jobId, { state: "paused" });
          if (!moved) return false;
          yield* interrupt(jobId);
          return true;
        }),

      resume: (id) =>
        Effect.gen(function* () {
          const jobId = yield* decodeUnknownFx(JobIdSchema, id);
          const job = yield* read(jobId, ["paused"]);
          if (job === null) return false;

          // Delete and re-insert, so the store's insertion order places the
          // resumed job behind everything queued while it was paused.
          return yield* transition(
            jobId,
            { state: "queued", progress: 0, error: null, result: null },
            { requeue: true },
          );
        }),

      cancel: (id) =>
        Effect.gen(function* () {
          const jobId = yield* decodeUnknownFx(JobIdSchema, id);
          const job = yield* read(jobId, ["queued", "running", "paused"]);
          if (job === null) return false;

          const moved = yield* transition(jobId, {
            state: "canceled",
            error: null,
            result: null,
          });
          if (!moved) return false;
          yield* interrupt(jobId);
          return true;
        }),

      wait: (id, options) =>
        Effect.gen(function* () {
          const jobId = yield* decodeUnknownFx(JobIdSchema, id);
          const decoded = yield* decodeUnknownFx(
            WaitOptionsSchema,
            options ?? {},
          );

          // The Deferred is registered before the record is read, so a job
          // that terminates between the read and the await is not missed. A
          // second `wait` on the same id joins the first one's Deferred.
          type Waiter = {
            readonly deferred: Deferred.Deferred<Job>;
            readonly owned: boolean;
          };
          const waiter = yield* Ref.modify(
            waiters,
            (map): readonly [Waiter, Map<JobId, Deferred.Deferred<Job>>] => {
              const existing = map.get(jobId);
              if (existing !== undefined) {
                return [{ deferred: existing, owned: false }, map];
              }
              const created = Deferred.makeUnsafe<Job>();
              const next = new Map(map);
              next.set(jobId, created);
              return [{ deferred: created, owned: true }, next];
            },
          );

          const body = Effect.gen(function* () {
            const current = yield* store.get(jobId);
            if (current === null) {
              return yield* queueError(
                "invalid_input",
                `No job with id '${jobId}' exists.`,
              );
            }
            if (isTerminal(current.state)) return current;

            const timeout = decoded.timeout_ms;
            if (timeout === undefined) {
              return yield* Deferred.await(waiter.deferred);
            }

            const outcome = yield* Deferred.await(waiter.deferred).pipe(
              Effect.timeoutOption(timeout),
            );
            if (Option.isNone(outcome)) {
              return yield* queueError(
                "timeout",
                `Job '${jobId}' did not finish within ${timeout}ms.`,
              );
            }
            return outcome.value;
          });

          // Only the call that installed the Deferred removes it, so one
          // timed-out waiter cannot strand a second one that joined it.
          return yield* body.pipe(
            Effect.ensuring(
              waiter.owned
                ? Ref.update(waiters, (map) => {
                    const next = new Map(map);
                    next.delete(jobId);
                    return next;
                  })
                : Effect.void,
            ),
          );
        }),

      watch: (filter) =>
        Stream.unwrap(
          Effect.map(
            decodeUnknownFx(ListFilterSchema, filter ?? {}),
            (decoded) => watchStream(bus, decoded),
          ),
        ),
    };

    return api;
  });
