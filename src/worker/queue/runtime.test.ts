import { describe, expect, it } from "vitest";
import { Deferred, Effect, Exit, Fiber, Ref, Scope, Stream } from "effect";

import { QueueError } from "@/worker/queue/error.ts";
import { createQueue, type QueueRuntime } from "@/worker/queue/runtime.ts";
import type { Job, QueueConfig } from "@/worker/queue/schema.ts";

/**
 * Every case builds its own runtime through `Scope.make` and closes the scope
 * when the program ends, so a scheduler or a job fiber from one case never
 * reaches another.
 */
function withQueue<A, E>(
  program: (queue: QueueRuntime) => Effect.Effect<A, E, Scope.Scope>,
  config?: Partial<QueueConfig>,
): Promise<A> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      return yield* Effect.gen(function* () {
        const queue = yield* createQueue(config);
        return yield* program(queue);
      }).pipe(
        Effect.provideService(Scope.Scope, scope),
        Effect.ensuring(Scope.close(scope, Exit.void)),
      );
    }),
  );
}

const sleep = (ms: number) => Effect.sleep(ms);

/** Polls `read` until it returns a value, so no test waits on a fixed sleep. */
function until<A>(
  read: Effect.Effect<A | null | undefined, QueueError, Scope.Scope>,
  ok: (value: A) => boolean,
  message = "condition never held",
): Effect.Effect<A, QueueError, Scope.Scope> {
  return Effect.gen(function* () {
    for (let attempt = 0; attempt < 400; attempt++) {
      const value = yield* read;
      if (value !== null && value !== undefined && ok(value)) return value;
      yield* sleep(5);
    }
    throw new Error(message);
  });
}

const isTerminal = (state: Job["state"]) =>
  state === "succeeded" || state === "failed" || state === "canceled";

const settled = (queue: QueueRuntime, id: string) =>
  until(
    queue.get(id),
    (job) => job !== null && isTerminal(job.state),
    `job '${id}' never settled`,
  );

const stateOf = (queue: QueueRuntime, id: string) =>
  Effect.map(queue.get(id), (job) => job?.state ?? "missing");

const recordOf = (queue: QueueRuntime, id: string) =>
  queue.get(id).pipe(
    Effect.flatMap((job) =>
      job === null ? Effect.die(`job '${id}' is missing`) : Effect.succeed(job)
    ),
  );

describe("queue.enqueue", () => {
  it("puts the job in queued with attempt 1, progress 0, and ISO timestamps", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        yield* queue.registry.register("upload", () => Effect.void);

        const job = yield* queue.enqueue({ kind: "upload" });

        expect(job.state).toBe("queued");
        expect(job.attempt).toBe(1);
        expect(job.progress).toBe(0);
        expect(job.created_at).toBe(new Date(job.created_at).toISOString());
        expect(job.updated_at).toBe(new Date(job.updated_at).toISOString());
        expect(job.result).toBeNull();
        expect(job.error).toBeNull();
        expect(job.payload).toBeNull();
      })
    ));

  it("fails an unregistered kind with unknown_kind and stores nothing", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(queue.enqueue({ kind: "nope" }));

        expect(error).toBeInstanceOf(QueueError);
        expect(error.reason).toBe("unknown_kind");
        expect(yield* queue.list()).toEqual([]);
      })
    ));

  it("fails at capacity live jobs with queue_full and stores nothing", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          yield* queue.registry.register("upload", () => Deferred.await(gate));

          const first = yield* queue.enqueue({ kind: "upload" });
          yield* until(
            stateOf(queue, first.id),
            (state) => state === "running",
          );

          const error = yield* Effect.flip(queue.enqueue({ kind: "upload" }));

          expect(error.reason).toBe("queue_full");
          expect(yield* queue.list()).toHaveLength(1);
        }),
      { capacity: 1, concurrency: 1 },
    ));
});

describe("queue scheduling", () => {
  it("runs the jobs one at a time in enqueue order at concurrency 1", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const order = yield* Ref.make<string[]>([]);
          const live = yield* Ref.make(0);
          let overlap = false;

          yield* queue.registry.register("upload", (ctx) =>
            Effect.gen(function* () {
              const count = yield* Ref.updateAndGet(live, (n) => {
                if (n > 0) {
                  overlap = true;
                }
                return n + 1;
              });
              yield* sleep(10);
              yield* Ref.update(live, () =>
                count - 1);
              yield* Ref.update(order, (current) => [...current, ctx.id]);
            }).pipe(Effect.as(1)));

          const a = yield* queue.enqueue({ kind: "upload" });
          const b = yield* queue.enqueue({ kind: "upload" });
          const c = yield* queue.enqueue({ kind: "upload" });

          yield* Effect.all(
            [a, b, c].map((job) =>
              settled(queue, job.id)
            ),
            { concurrency: 3 },
          );

          expect(overlap).toBe(false);
          expect(yield* Ref.get(order)).toEqual([a.id, b.id, c.id]);
        }),
      { concurrency: 1 },
    ));

  it("keeps a third job queued at concurrency 2 until one is terminal", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          const started = yield* Ref.make<string[]>([]);
          yield* queue.registry.register("upload", (ctx) =>
            Ref.update(started, (current) => [...current, ctx.id]).pipe(
              Effect.andThen(Deferred.await(gate)),
              Effect.as(1),
            ));

          const a = yield* queue.enqueue({ kind: "upload" });
          yield* queue.enqueue({ kind: "upload" });
          const c = yield* queue.enqueue({ kind: "upload" });

          yield* until(Ref.get(started), (ids) =>
            ids.length === 2);
          expect(yield* stateOf(queue, c.id)).toBe("queued");

          yield* Deferred.succeed(gate, undefined);
          yield* settled(queue, a.id);
          yield* until(Ref.get(started), (ids) =>
            ids.includes(c.id));
        }),
      { concurrency: 2 },
    ));
});

describe("queue results", () => {
  it("stores a successful return value in result and reaches succeeded at progress 1", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        yield* queue.registry.register("upload", () =>
          Effect.succeed({ ok: 42 }));

        const job = yield* queue.enqueue({ kind: "upload" });
        yield* settled(queue, job.id);

        const record = yield* recordOf(queue, job.id);
        expect(record.state).toBe("succeeded");
        expect(record.progress).toBe(1);
        expect(record.result).toEqual({ ok: 42 });
        expect(record.error).toBeNull();
      })
    ));

  it("stores the failure message in error, reaches failed, and keeps running the next job", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          yield* queue.registry.register("boom", () =>
            Effect.fail(
              new QueueError({ error: "it broke", reason: "invalid_input" }),
            ));
          yield* queue.registry.register("upload", () => Effect.succeed(1));

          const failed = yield* queue.enqueue({ kind: "boom" });
          const next = yield* queue.enqueue({ kind: "upload" });

          yield* settled(queue, failed.id);
          yield* settled(queue, next.id);

          const record = yield* recordOf(queue, failed.id);
          expect(record.state).toBe("failed");
          expect(record.error).toContain("it broke");
          expect(yield* stateOf(queue, next.id)).toBe("succeeded");
        }),
      { concurrency: 1 },
    ));
});

describe("queue.wait", () => {
  it("returns the terminal record and returns immediately for a terminal job", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        yield* queue.registry.register("upload", () => Effect.succeed(7));

        const job = yield* queue.enqueue({ kind: "upload" });
        const waited = yield* queue.wait(job.id);
        expect(waited.state).toBe("succeeded");
        expect(waited.result).toBe(7);

        const again = yield* queue.wait(job.id);
        expect(again.state).toBe("succeeded");
      })
    ));

  it("fails with timeout while the job is still running", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        const gate = yield* Deferred.make<void>();
        yield* queue.registry.register("upload", () => Deferred.await(gate));

        const job = yield* queue.enqueue({ kind: "upload" });
        yield* until(stateOf(queue, job.id), (state) => state === "running");

        const error = yield* Effect.flip(
          queue.wait(job.id, { timeout_ms: 30 }),
        );

        expect(error).toBeInstanceOf(QueueError);
        expect(error.reason).toBe("timeout");
        expect(yield* stateOf(queue, job.id)).toBe("running");
      })
    ));

  it("keeps a second waiter alive when the first one times out", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        const gate = yield* Deferred.make<void>();
        yield* queue.registry.register("upload", () => Deferred.await(gate));

        const job = yield* queue.enqueue({ kind: "upload" });
        yield* until(stateOf(queue, job.id), (state) => state === "running");

        // The timed-out waiter owns the Deferred, so its cleanup must not
        // strand the second waiter that joined it.
        const fiber = yield* Effect.forkChild(queue.wait(job.id));
        yield* Effect.sleep(20);
        const timedOut = yield* Effect.flip(
          queue.wait(job.id, { timeout_ms: 30 }),
        );
        expect(timedOut.reason).toBe("timeout");

        yield* Deferred.succeed(gate, undefined);
        const waited = yield* Effect.timeoutOption(Fiber.join(fiber), 2000);
        expect(waited._tag).toBe("Some");
      })
    ));

  it("fails invalid_input for an id that was never enqueued", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(queue.wait("missing"));
        expect(error.reason).toBe("invalid_input");
      })
    ));
});

describe("queue.progress", () => {
  it("updates the record while running", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        const gate = yield* Deferred.make<void>();
        const reported = yield* Deferred.make<boolean>();
        yield* queue.registry.register("upload", (ctx) =>
          ctx.progress(0.5).pipe(
            Effect.flatMap((accepted) => Deferred.succeed(reported, accepted)),
            Effect.andThen(Deferred.await(gate)),
          ));

        const job = yield* queue.enqueue({ kind: "upload" });
        expect(yield* Deferred.await(reported)).toBe(true);
        expect((yield* queue.get(job.id))?.progress).toBe(0.5);
      })
    ));

  it("returns false and writes nothing after the job is terminal", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        let late: Effect.Effect<boolean, QueueError, never> | null = null;
        yield* queue.registry.register("upload", (ctx) => {
          late = ctx.progress(0.5);
          return Effect.succeed(1);
        });

        const job = yield* queue.enqueue({ kind: "upload" });
        yield* settled(queue, job.id);

        expect(yield* late!).toBe(false);
        expect((yield* queue.get(job.id))?.progress).toBe(1);
      })
    ));
});

describe("queue.pause and queue.resume", () => {
  it("pauses a queued job and the loop never starts it", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          const started = yield* Ref.make<string[]>([]);
          yield* queue.registry.register("upload", (ctx) =>
            Ref.update(started, (current) => [...current, ctx.id]).pipe(
              Effect.andThen(Deferred.await(gate)),
              Effect.as(1),
            ));

          const blocker = yield* queue.enqueue({ kind: "upload" });
          const paused = yield* queue.enqueue({ kind: "upload" });
          yield* until(Ref.get(started), (ids) => ids.length === 1);

          expect(yield* queue.pause(paused.id)).toBe(true);
          expect(yield* stateOf(queue, paused.id)).toBe("paused");

          // The loop already scanned the paused job, so it must skip it when
          // the permit frees.
          yield* Deferred.succeed(gate, undefined);
          yield* settled(queue, blocker.id);
          yield* sleep(30);

          expect(yield* Ref.get(started)).toEqual([blocker.id]);
          expect(yield* stateOf(queue, paused.id)).toBe("paused");
        }),
      { concurrency: 1 },
    ));

  it("resumes a paused job and runs it to succeeded", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          const started = yield* Ref.make<string[]>([]);
          yield* queue.registry.register("upload", (ctx) =>
            Ref.update(started, (current) => [...current, ctx.id]).pipe(
              Effect.andThen(Deferred.await(gate)),
              Effect.as(1),
            ));

          const blocker = yield* queue.enqueue({ kind: "upload" });
          const job = yield* queue.enqueue({ kind: "upload" });
          yield* until(Ref.get(started), (ids) => ids.length === 1);

          expect(yield* queue.pause(job.id)).toBe(true);
          expect(yield* queue.resume(job.id)).toBe(true);
          expect(yield* stateOf(queue, job.id)).toBe("queued");

          yield* Deferred.succeed(gate, undefined);
          yield* settled(queue, blocker.id);
          yield* settled(queue, job.id);

          expect(yield* Ref.get(started)).toEqual([blocker.id, job.id]);
          expect(yield* stateOf(queue, job.id)).toBe("succeeded");
        }),
      { concurrency: 1 },
    ));

  it("resumes behind every job that was queued while it was paused", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          const started = yield* Ref.make<string[]>([]);
          yield* queue.registry.register("upload", (ctx) =>
            Ref.update(started, (current) => [...current, ctx.id]).pipe(
              Effect.andThen(sleep(5)),
              Effect.as(1),
            ));
          yield* queue.registry.register("hold", () =>
            Deferred.await(gate));

          // The `hold` job takes the only permit, so the store's order decides
          // the run order.
          const blocker = yield* queue.enqueue({ kind: "hold" });
          yield* until(stateOf(queue, blocker.id), (s) =>
            s === "running");

          const a = yield* queue.enqueue({ kind: "upload" });
          expect(yield* queue.pause(a.id)).toBe(true);

          const b = yield* queue.enqueue({ kind: "upload" });
          const c = yield* queue.enqueue({ kind: "upload" });
          expect(yield* queue.resume(a.id)).toBe(true);

          yield* Deferred.succeed(gate, undefined);
          yield* Effect.all(
            [a, b, c].map((job) => settled(queue, job.id)),
            { concurrency: 3 },
          );

          expect(yield* Ref.get(started)).toEqual([b.id, c.id, a.id]);
        }),
      { concurrency: 1 },
    ));

  it("does not let the interrupted run finalize the restarted job", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const runs = yield* Ref.make(0);
          const firstEntered = yield* Deferred.make<void>();
          const releaseFirst = yield* Deferred.make<void>();
          const releaseSecond = yield* Deferred.make<void>();

          yield* queue.registry.register("upload", () =>
            Effect.gen(function* () {
              const run = yield* Ref.updateAndGet(runs, (n) => n + 1);
              if (run === 1) {
                yield* Deferred.succeed(firstEntered, undefined);
                // The finalizer is slow, so the first run is still unwinding
                // while the second run has already started.
                return yield* Effect.onExit(Deferred.await(releaseFirst), () =>
                  sleep(80)
                ).pipe(Effect.andThen(Effect.succeed("run-1")));
              }
              return yield* Deferred.await(releaseSecond).pipe(
                Effect.andThen(Effect.succeed("run-2")),
              );
            }));

          const job = yield* queue.enqueue({ kind: "upload" });
          yield* Deferred.await(firstEntered);

          // `pause` is not awaited, so `resume` can arrive while `pause`
          // still waits for the interrupt to finish.
          yield* Effect.forkChild(queue.pause(job.id));
          yield* until(stateOf(queue, job.id), (s) => s === "paused");

          expect(yield* queue.resume(job.id)).toBe(true);
          yield* until(Ref.get(runs), (n) => n === 2);

          // The first run finishes its unwind inside the second run.
          yield* sleep(140);
          expect(yield* stateOf(queue, job.id)).toBe("running");

          yield* Deferred.succeed(releaseSecond, undefined);
          yield* settled(queue, job.id);

          const record = yield* recordOf(queue, job.id);
          expect(record.state).toBe("succeeded");
          expect(record.result).toBe("run-2");
        }),
      { concurrency: 2 },
    ));

  it("interrupts a running job, runs its finalizer, and records no failure", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        const cleaned = yield* Ref.make(false);
        const entered = yield* Deferred.make<void>();
        yield* queue.registry.register("upload", () =>
          Effect.onExit(
            Deferred.succeed(entered, undefined),
            () => Ref.set(cleaned, true),
          ).pipe(Effect.andThen(sleep(60_000))));

        const job = yield* queue.enqueue({ kind: "upload" });
        yield* Deferred.await(entered);

        expect(yield* queue.pause(job.id)).toBe(true);
        yield* until(Ref.get(cleaned), (done) => done);
        yield* sleep(20);

        const record = yield* recordOf(queue, job.id);
        expect(record.state).toBe("paused");
        expect(record.error).toBeNull();
      })
    ));
});

describe("queue.cancel", () => {
  it("aborts the signal of a running job, runs the finalizer, and leaves error null", () =>
    withQueue((queue) =>
      Effect.gen(function* () {
        const cleaned = yield* Ref.make(false);
        const entered = yield* Deferred.make<void>();
        let signal: AbortSignal | null = null;

        yield* queue.registry.register("upload", (ctx) => {
          signal = ctx.signal;
          return Effect.onExit(
            Deferred.succeed(entered, undefined),
            () => Ref.set(cleaned, true),
          ).pipe(Effect.andThen(sleep(60_000)));
        });

        const job = yield* queue.enqueue({ kind: "upload" });
        yield* Deferred.await(entered);

        expect(yield* queue.cancel(job.id)).toBe(true);
        yield* until(Ref.get(cleaned), (done) => done);
        // The controller is closed after the handler's own finalizer, so the
        // abort lands last.
        yield* until(
          Effect.sync(() => signal!.aborted),
          (aborted) => aborted,
        );
        const record = yield* recordOf(queue, job.id);
        expect(record.state).toBe("canceled");
        expect(record.error).toBeNull();
        expect(record.result).toBeNull();
      })
    ));

  it("cancels a queued job and never runs it", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          const started = yield* Ref.make<string[]>([]);
          yield* queue.registry.register("upload", (ctx) =>
            Ref.update(started, (current) => [...current, ctx.id]).pipe(
              Effect.andThen(Deferred.await(gate)),
              Effect.as(1),
            ));

          const blocker = yield* queue.enqueue({ kind: "upload" });
          const canceled = yield* queue.enqueue({ kind: "upload" });
          yield* until(Ref.get(started), (ids) => ids.length === 1);

          expect(yield* queue.cancel(canceled.id)).toBe(true);
          expect(yield* stateOf(queue, canceled.id)).toBe("canceled");

          yield* Deferred.succeed(gate, undefined);
          yield* settled(queue, blocker.id);
          yield* sleep(30);

          expect(yield* Ref.get(started)).toEqual([blocker.id]);
          expect(yield* stateOf(queue, canceled.id)).toBe("canceled");
        }),
      { concurrency: 1 },
    ));

  it("returns false on a terminal job, on a paused job, and on a missing id", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          yield* queue.registry.register("upload", () => Effect.succeed(1));
          yield* queue.registry.register("hold", () => Deferred.await(gate));

          const blocker = yield* queue.enqueue({ kind: "hold" });
          yield* until(stateOf(queue, blocker.id), (s) => s === "running");

          // A queued job that is paused can no longer move.
          const paused = yield* queue.enqueue({ kind: "upload" });
          expect(yield* queue.pause(paused.id)).toBe(true);
          expect(yield* queue.pause(paused.id)).toBe(false);
          expect(yield* queue.cancel(paused.id)).toBe(true);

          yield* Deferred.succeed(gate, undefined);
          yield* settled(queue, blocker.id);

          const done = yield* queue.enqueue({ kind: "upload" });
          yield* settled(queue, done.id);
          const before = yield* recordOf(queue, done.id);

          expect(yield* queue.resume(done.id)).toBe(false);
          expect(yield* queue.pause(done.id)).toBe(false);
          expect(yield* queue.cancel(done.id)).toBe(false);
          expect(yield* queue.pause("missing")).toBe(false);
          expect(yield* queue.resume("missing")).toBe(false);
          expect(yield* queue.cancel("missing")).toBe(false);
          expect(yield* queue.get("missing")).toBeNull();

          const invalid = yield* Effect.flip(queue.get(""));
          expect(invalid.reason).toBe("invalid_input");

          expect(yield* recordOf(queue, done.id)).toEqual(before);
        }),
      { concurrency: 1 },
    ));
});

describe("queue.watch", () => {
  it("emits the current list as its first element", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          yield* queue.registry.register("upload", () => Effect.succeed(1));
          yield* queue.registry.register("hold", () => Deferred.await(gate));

          const blocker = yield* queue.enqueue({ kind: "hold" });
          yield* until(stateOf(queue, blocker.id), (s) => s === "running");

          const job = yield* queue.enqueue({ kind: "upload" });

          const seen = yield* Ref.make<Job[][]>([]);
          yield* Effect.forkChild(
            queue.watch().pipe(
              Stream.runForEach((jobs) =>
                Ref.update(seen, (current) => [...current, jobs])
              ),
            ),
          );
          yield* sleep(20);

          const emissions = yield* Ref.get(seen);
          expect(emissions.length).toBeGreaterThan(0);
          const first = emissions[0];
          expect(first.map((entry) => entry.id)).toContain(blocker.id);
          expect(first.map((entry) => entry.id)).toContain(job.id);
          expect(first.find((entry) => entry.id === job.id)?.state).toBe(
            "queued",
          );
        }),
      { concurrency: 1 },
    ));

  it("emits a new full list after each transition and shows the paused then resumed job", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          yield* queue.registry.register("upload", () => Effect.succeed(1));
          yield* queue.registry.register("hold", () => Deferred.await(gate));

          const blocker = yield* queue.enqueue({ kind: "hold" });
          yield* until(stateOf(queue, blocker.id), (s) => s === "running");

          const job = yield* queue.enqueue({ kind: "upload" });

          const seen = yield* Ref.make<Job[][]>([]);
          yield* Effect.forkChild(
            queue.watch().pipe(
              Stream.runForEach((jobs) =>
                Ref.update(seen, (current) => [...current, jobs])
              ),
            ),
          );
          yield* sleep(20);

          const history = () =>
            Ref.get(seen).pipe(
              Effect.map((emissions) =>
                emissions.map(
                  (jobs) =>
                    jobs.find((entry) => entry.id === job.id)?.state ??
                      "absent",
                )
              ),
            );

          yield* queue.pause(job.id);
          yield* until(history(), (states) => states.at(-1) === "paused");

          yield* queue.resume(job.id);
          yield* until(history(), (states) => states.at(-1) === "queued");

          const states = yield* history();
          // Every element is the whole list, not a delta.
          expect(states.length).toBeGreaterThanOrEqual(3);
          expect(states).toContain("paused");
          expect(states.indexOf("paused")).toBeLessThan(
            states.lastIndexOf("queued"),
          );
        }),
      { concurrency: 1 },
    ));

  it("never emits a job outside the states filter", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          yield* queue.registry.register("upload", () => Effect.succeed(1));
          yield* queue.registry.register("hold", () => Deferred.await(gate));

          const blocker = yield* queue.enqueue({ kind: "hold" });
          yield* until(stateOf(queue, blocker.id), (s) => s === "running");

          const seen = yield* Ref.make<Job[][]>([]);
          yield* Effect.forkChild(
            queue.watch({ states: ["queued"] }).pipe(
              Stream.runForEach((jobs) =>
                Ref.update(seen, (current) => [...current, jobs])
              ),
            ),
          );
          yield* sleep(20);

          const queued = yield* queue.enqueue({ kind: "upload" });
          yield* queue.pause(queued.id);
          yield* sleep(30);

          const emissions = yield* Ref.get(seen);
          expect(emissions.length).toBeGreaterThan(0);
          for (const jobs of emissions) {
            expect(jobs.every((entry) => entry.state === "queued")).toBe(true);
            expect(jobs.map((entry) => entry.id)).not.toContain(queued.id);
            expect(jobs.map((entry) => entry.id)).not.toContain(blocker.id);
          }
        }),
      { concurrency: 1 },
    ));

  it("feeds two streams independently", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>();
          yield* queue.registry.register("upload", () => Effect.succeed(1));
          yield* queue.registry.register("hold", () => Deferred.await(gate));

          const blocker = yield* queue.enqueue({ kind: "hold" });
          yield* until(stateOf(queue, blocker.id), (s) => s === "running");

          const first = yield* Ref.make<Job[][]>([]);
          const second = yield* Ref.make<Job[][]>([]);
          const collect = (target: Ref.Ref<Job[][]>) =>
            Effect.forkChild(
              queue.watch().pipe(
                Stream.runForEach((jobs) =>
                  Ref.update(target, (current) => [...current, jobs])
                ),
              ),
            );

          yield* collect(first);
          yield* collect(second);
          yield* sleep(20);

          const job = yield* queue.enqueue({ kind: "upload" });
          yield* queue.pause(job.id);

          const sawPause = (target: Ref.Ref<Job[][]>) =>
            Ref.get(target).pipe(
              Effect.map((emissions) =>
                emissions.some((jobs) =>
                  jobs.some((entry) =>
                    entry.id === job.id && entry.state === "paused"
                  )
                )
              ),
            );

          yield* until(sawPause(first), (seen) => seen);
          yield* until(sawPause(second), (seen) => seen);
        }),
      { concurrency: 1 },
    ));
});

describe("queue scheduler", () => {
  it("keeps running jobs after a burst of concurrent control calls", () =>
    withQueue(
      (queue) =>
        Effect.gen(function* () {
          const entered = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();

          yield* queue.registry.register("upload", () =>
            Effect.andThen(
              Deferred.succeed(entered, undefined),
              Deferred.await(release),
            ));

          const blocked = yield* queue.enqueue({ kind: "upload" });
          yield* Deferred.await(entered);

          // One permit is held by the blocked job. Each call below is a
          // separate worker message, so they arrive on separate fibers. None
          // of them may consume or return a permit.
          const calls = [
            queue.pause(blocked.id),
            queue.resume(blocked.id),
            queue.resume(blocked.id),
            queue.pause(blocked.id),
            queue.cancel(blocked.id),
            queue.cancel(blocked.id),
            queue.resume(blocked.id),
          ];
          yield* Effect.all(calls, { concurrency: "unbounded", discard: true });
          yield* sleep(40);

          // The job is canceled. The queue still has to run the next job,
          // which it cannot do if a permit went missing.
          const next = yield* queue.enqueue({ kind: "upload" });
          yield* until(stateOf(queue, next.id), (s) => s === "running");
          yield* Deferred.succeed(release, undefined);

          yield* settled(queue, next.id);
          expect((yield* recordOf(queue, next.id)).state).toBe("succeeded");
          expect((yield* recordOf(queue, blocked.id)).state).toBe("canceled");
        }),
      { concurrency: 1 },
    ));
});

describe("queue scope", () => {
  it("interrupts a running job and stops the scheduler when the scope closes", () => {
    const cleaned = { current: false };
    let id = "";

    const program = Effect.gen(function* () {
      const scope = yield* Scope.make();
      const api = yield* createQueue({ concurrency: 1 }).pipe(
        Effect.provideService(Scope.Scope, scope),
      );
      const entered = yield* Deferred.make<void>();
      yield* api.registry.register("upload", () =>
        Effect.onExit(
          Deferred.succeed(entered, undefined),
          () =>
            Effect.sync(() => {
              cleaned.current = true;
            }),
        ).pipe(Effect.andThen(sleep(60_000))));

      const job = yield* api.enqueue({ kind: "upload" });
      id = job.id;
      yield* Deferred.await(entered);

      // Closing the scope interrupts the job and the scheduler together.
      yield* Scope.close(scope, Exit.void);
      yield* sleep(20);

      const record = yield* api.get(job.id);
      expect(record?.state).toBe("running");
      expect(record?.error).toBeNull();

      // The scheduler is gone, so a later enqueue is never picked up.
      const later = yield* api.enqueue({ kind: "upload" });
      yield* sleep(40);
      expect((yield* api.get(later.id))?.state).toBe("queued");
    });

    return Effect.runPromise(program).then(() => {
      expect(cleaned.current).toBe(true);
      expect(id).toBeTypeOf("string");
    });
  });
});
