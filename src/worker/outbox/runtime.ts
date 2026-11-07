import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Option,
  Queue,
  Ref,
  Result,
  Schema,
  Scope,
  Stream,
} from "effect";
import { v7 as randomUUID } from "uuid";

import type {
  OutboxCounts,
  OutboxEnqueueInput,
  OutboxFlushResult,
  OutboxHandler,
  OutboxOp,
  OutboxStatus,
} from "@/lib/outbox/types.ts";
import {
  DEFAULT_BACKOFF,
  backoffDelayMs,
  type BackoffOptions,
} from "@/worker/outbox/backoff.ts";
import {
  classifyOutcome,
  outcomeFromError,
  outcomeFromResult,
  type OutboxOutcome,
} from "@/worker/outbox/classify.ts";
import { outboxError, type OutboxError } from "@/worker/outbox/error.ts";
import {
  createRegistry,
  type OutboxRegistry,
} from "@/worker/outbox/registry.ts";
import {
  OutboxEnqueueInputSchema,
  toOutboxOp,
  type OutboxRecord,
} from "@/worker/outbox/schema.ts";
import type { OutboxTableApi } from "@/worker/outbox/table.ts";

export type OutboxApi = {
  readonly enqueue: (
    input: OutboxEnqueueInput,
  ) => Effect.Effect<OutboxOp, OutboxError, never>;
  readonly get: (
    id: string,
  ) => Effect.Effect<OutboxOp | null, OutboxError, never>;
  readonly list: () => Effect.Effect<OutboxOp[], OutboxError, never>;
  readonly status: () => Effect.Effect<OutboxStatus, OutboxError, never>;
  readonly watch: () => Stream.Stream<OutboxStatus, OutboxError, never>;
  readonly flush: () => Effect.Effect<OutboxFlushResult, OutboxError, never>;
  readonly resume: () => Effect.Effect<void, OutboxError, never>;
};

// The registry hangs off the runtime, not off `OutboxApi`, so it never crosses
// the port. `register` is worker-side only.
export type OutboxRuntime = {
  readonly api: OutboxApi;
  readonly registry: OutboxRegistry;
  /** Succeeds after the recovery of the interrupted rows. */
  readonly ready: Effect.Effect<void, OutboxError>;
};

export type CreateOutboxOptions = {
  table: OutboxTableApi;
  /** The clock. The tests replace it with a fixed clock. */
  now?: () => number;
  /** The jitter source. The tests replace it with a constant. */
  random?: () => number;
  /** The delay of the first retry in milliseconds. */
  baseDelayMs?: number;
  /** The largest delay in milliseconds. */
  maxDelayMs?: number;
};

const storageError = (error: unknown) => outboxError("storage", error);

const decodeEnqueueInput = (
  input: OutboxEnqueueInput,
): Effect.Effect<OutboxEnqueueInput, OutboxError> =>
  Schema.decodeUnknownEffect(OutboxEnqueueInputSchema)(input).pipe(
    Effect.mapError((error) => outboxError("invalid_input", error)),
  );

function compareOps(left: OutboxOp, right: OutboxOp): number {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

function countsOf(ops: readonly OutboxOp[]): OutboxCounts {
  return {
    pending: ops.filter((op) => op.state === "pending").length,
    sending: ops.filter((op) => op.state === "sending").length,
    failed: ops.filter((op) => op.state === "failed").length,
    conflict: ops.filter((op) => op.state === "conflict").length,
  };
}

function writeInput(op: OutboxOp) {
  return {
    kind: op.kind,
    method: op.method,
    path: op.path,
    body: op.body,
    createdAt: op.createdAt,
    attempts: op.attempts,
    nextAttemptAt: op.nextAttemptAt,
    state: op.state,
    ...(op.lastError === undefined ? {} : { lastError: op.lastError }),
  };
}

/**
 * Creates the outbox runtime for one table.
 * The runtime recovers the interrupted rows on a fiber.
 * The runtime runs one flusher fiber.
 */
export function createOutbox(
  options: CreateOutboxOptions,
): Effect.Effect<OutboxRuntime, OutboxError, Scope.Scope> {
  return Effect.gen(function* () {
    const { table } = options;
    const now = options.now ?? Date.now;
    const random = options.random ?? Math.random;
    const backoff: BackoffOptions = {
      baseMs: options.baseDelayMs ?? DEFAULT_BACKOFF.baseMs,
      maxMs: options.maxDelayMs ?? DEFAULT_BACKOFF.maxMs,
    };
    const registry = yield* createRegistry();
    const scope = yield* Scope.Scope;

    const paused = yield* Ref.make(false);
    const signInRequired = yield* Ref.make(false);
    const active = yield* Ref.make<
      Option.Option<Deferred.Deferred<OutboxFlushResult, OutboxError>>
    >(Option.none());
    const triggers =
      yield* Queue.unbounded<
        Deferred.Deferred<OutboxFlushResult, OutboxError>
      >();
    const recovered = yield* Deferred.make<void, OutboxError>();

    const listAll = (): Effect.Effect<OutboxOp[], OutboxError> =>
      Stream.runCollect(
        Stream.take(table.watch({ direction: "next" }), 1),
      ).pipe(
        Effect.map((chunks) => {
          const rows = (chunks.at(0) ?? []) as OutboxRecord[];
          return rows.map(toOutboxOp).sort(compareOps);
        }),
        Effect.mapError(storageError),
      );

    const putOp = (op: OutboxOp): Effect.Effect<void, OutboxError> =>
      table.set(op.id, writeInput(op)).pipe(Effect.mapError(storageError));

    const statusOf = (
      ops: readonly OutboxOp[],
    ): Effect.Effect<OutboxStatus, OutboxError> =>
      Effect.gen(function* () {
        return {
          ...countsOf(ops),
          paused: yield* Ref.get(paused),
          signInRequired: yield* Ref.get(signInRequired),
        };
      });

    const getOp = (id: string): Effect.Effect<OutboxOp | null, OutboxError> =>
      Effect.gen(function* () {
        const exists = yield* table.exists(id);
        if (!exists) return null;
        const record = yield* table.get(id);
        return toOutboxOp(record);
      }).pipe(Effect.mapError(storageError));

    const recover = (): Effect.Effect<void, OutboxError> =>
      Effect.gen(function* () {
        const rows = yield* listAll();
        const interrupted = rows.filter((op) => op.state === "sending");

        yield* Effect.forEach(
          interrupted,
          (op) => putOp({ ...op, state: "pending", nextAttemptAt: now() }),
          { discard: true },
        );
      });

    const callHandler = (
      handler: OutboxHandler,
      op: OutboxOp,
    ): Effect.Effect<OutboxOutcome> =>
      Effect.promise(async () => {
        try {
          return outcomeFromResult(await handler(op));
        } catch (error) {
          return outcomeFromError(error);
        }
      });

    const drain = (): Effect.Effect<OutboxFlushResult, OutboxError> =>
      Effect.gen(function* () {
        let sent = 0;
        let failed = 0;
        let conflict = 0;

        if (!(yield* Ref.get(paused))) {
          while (true) {
            // The list is ordered by `createdAt` and `id`. The head row blocks
            // the drain until it succeeds or its backoff ends, so the sends keep
            // the creation order.
            const rows = yield* listAll();
            const head = rows.find((op) => op.state === "pending");
            if (head === undefined) break;
            if (head.nextAttemptAt > now()) break;

            const found = yield* registry.lookup(head.kind).pipe(Effect.option);
            if (Option.isNone(found)) {
              yield* putOp({
                ...head,
                state: "failed",
                lastError: {
                  code: "unknown_kind",
                  message: `No handler is registered for kind '${head.kind}'.`,
                },
                nextAttemptAt: now(),
              });
              failed += 1;
              continue;
            }

            const attempts = head.attempts + 1;
            const sending: OutboxOp = { ...head, state: "sending", attempts };

            // The `sending` state is durable before the network call. A crash
            // during the call leaves a row that the next start moves to pending.
            yield* putOp(sending);

            const outcome = yield* callHandler(found.value, head);
            const classification = classifyOutcome(outcome);

            if (classification.kind === "success") {
              yield* table
                .complete(head.id, classification.local)
                .pipe(Effect.mapError(storageError));
              sent += 1;
              continue;
            }

            if (classification.kind === "unauthorized") {
              yield* Ref.set(paused, true);
              yield* Ref.set(signInRequired, true);
              yield* putOp({
                ...sending,
                state: "pending",
                lastError: classification.error,
                nextAttemptAt: now(),
              });
              break;
            }

            if (classification.kind === "permanent") {
              yield* putOp({
                ...sending,
                state: classification.state,
                lastError: classification.error,
                nextAttemptAt: now(),
              });
              if (classification.state === "conflict") conflict += 1;
              else failed += 1;
              continue;
            }

            const delay = backoffDelayMs(attempts, random, backoff);
            yield* putOp({
              ...sending,
              state: "pending",
              lastError: classification.error,
              nextAttemptAt: now() + delay,
            });
            break;
          }
        }

        const rows = yield* listAll();
        return {
          ...countsOf(rows),
          sent,
          paused: yield* Ref.get(paused),
          signInRequired: yield* Ref.get(signInRequired),
        };
      });

    const clearActive = (
      deferred: Deferred.Deferred<OutboxFlushResult, OutboxError>,
    ): Effect.Effect<void> =>
      Ref.update(active, (current) =>
        Option.isSome(current) && current.value === deferred
          ? Option.none()
          : current,
      );

    const failTrigger = (
      deferred: Deferred.Deferred<OutboxFlushResult, OutboxError>,
      cause: Cause.Cause<OutboxError>,
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        const failure = Cause.findFail(cause);
        const error = Result.isSuccess(failure)
          ? failure.success.error
          : outboxError("storage", Cause.pretty(cause));
        yield* Deferred.fail(deferred, error);
      });

    const completeTrigger = (
      deferred: Deferred.Deferred<OutboxFlushResult, OutboxError>,
      exit: Exit.Exit<OutboxFlushResult, OutboxError>,
    ): Effect.Effect<void> =>
      Exit.isSuccess(exit)
        ? Effect.asVoid(Deferred.succeed(deferred, exit.value))
        : failTrigger(deferred, exit.cause);

    const runTrigger = (
      deferred: Deferred.Deferred<OutboxFlushResult, OutboxError>,
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Deferred.await(recovered);
        return yield* drain();
      }).pipe(
        Effect.onExit((exit) => completeTrigger(deferred, exit)),
        Effect.ignore,
      );

    const failActiveOnShutdown = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(active);
        if (Option.isNone(current)) return;
        const deferred = current.value;
        yield* Deferred.fail(
          deferred,
          outboxError("storage", "The worker scope closed during a flush."),
        );
        yield* clearActive(deferred);
      });

    yield* Effect.forkIn(
      Effect.exit(recover()).pipe(
        Effect.flatMap((exit) =>
          Exit.isSuccess(exit)
            ? Deferred.succeed(recovered, undefined)
            : Deferred.failCause(recovered, exit.cause),
        ),
      ),
      scope,
    );

    yield* Effect.forkIn(
      Effect.gen(function* () {
        while (true) {
          const deferred = yield* Queue.take(triggers);
          yield* runTrigger(deferred);
        }
      }).pipe(Effect.onInterrupt(() => failActiveOnShutdown())),
      scope,
    );

    const api: OutboxApi = {
      enqueue: (input) =>
        Effect.gen(function* () {
          const decoded = yield* decodeEnqueueInput(input);
          yield* registry.lookup(decoded.kind);

          const createdAt = decoded.createdAt ?? now();
          const op: OutboxOp = {
            id: randomUUID(),
            kind: decoded.kind,
            method: decoded.method,
            path: decoded.path,
            body: decoded.body ?? null,
            createdAt,
            attempts: 0,
            nextAttemptAt: createdAt,
            state: "pending",
          };

          yield* table
            .append(op, decoded.local ?? [])
            .pipe(Effect.mapError(storageError));

          return op;
        }),

      get: getOp,

      list: listAll,

      status: () => Effect.flatMap(listAll(), statusOf),

      watch: () =>
        table.watch({ direction: "next" }).pipe(
          Stream.mapEffect((rows) => statusOf(rows.map(toOutboxOp))),
          Stream.mapError(storageError),
        ),

      flush: () =>
        Effect.gen(function* () {
          const created = yield* Deferred.make<
            OutboxFlushResult,
            OutboxError
          >();
          type FlushSlot =
            | { readonly owned: true; readonly deferred: typeof created }
            | { readonly owned: false; readonly deferred: typeof created };
          const slot = yield* Ref.modify(
            active,
            (
              current,
            ): readonly [
              FlushSlot,
              Option.Option<Deferred.Deferred<OutboxFlushResult, OutboxError>>,
            ] =>
              Option.isSome(current)
                ? [{ owned: false, deferred: current.value }, current]
                : [{ owned: true, deferred: created }, Option.some(created)],
          );

          if (!slot.owned) {
            return yield* Deferred.await(slot.deferred);
          }

          return yield* Queue.offer(triggers, created).pipe(
            Effect.andThen(Deferred.await(created)),
            Effect.ensuring(clearActive(created)),
          );
        }),

      resume: () =>
        Effect.gen(function* () {
          yield* Ref.set(paused, false);
          yield* Ref.set(signInRequired, false);
        }),
    };

    return { api, registry, ready: Deferred.await(recovered) };
  });
}
