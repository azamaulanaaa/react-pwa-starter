import { Effect, Option, Schema, Stream } from "effect";
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
  /** Resolves after the recovery of the interrupted rows. */
  readonly ready: Promise<void>;
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
 * The runtime recovers the interrupted rows at start.
 * The runtime runs one flusher at a time.
 */
export function createOutbox(options: CreateOutboxOptions): OutboxRuntime {
  const { table } = options;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const backoff: BackoffOptions = {
    baseMs: options.baseDelayMs ?? DEFAULT_BACKOFF.baseMs,
    maxMs: options.maxDelayMs ?? DEFAULT_BACKOFF.maxMs,
  };
  const registry = Effect.runSync(createRegistry());

  let paused = false;
  let signInRequired = false;
  let active: Promise<OutboxFlushResult> | null = null;
  let readyFailure: unknown = null;

  const listAll = (): Effect.Effect<OutboxOp[], OutboxError> =>
    Stream.runCollect(Stream.take(table.watch({ direction: "next" }), 1)).pipe(
      Effect.map((chunks) => {
        const rows = (chunks.at(0) ?? []) as OutboxRecord[];
        return rows.map(toOutboxOp).sort(compareOps);
      }),
      Effect.mapError(storageError),
    );

  const putOp = (op: OutboxOp): Effect.Effect<void, OutboxError> =>
    table.set(op.id, writeInput(op)).pipe(Effect.mapError(storageError));

  const statusOf = (ops: readonly OutboxOp[]): OutboxStatus => ({
    ...countsOf(ops),
    paused,
    signInRequired,
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

      if (!paused) {
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
            paused = true;
            signInRequired = true;
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
        paused,
        signInRequired,
      };
    });

  const ready = Effect.runPromise(recover()).then(
    () => undefined,
    (error: unknown) => {
      // The flush reports the stored failure. A rejection that no caller
      // reads would stop the worker with an unhandled error.
      readyFailure = error;
    },
  );

  const awaitReady = (): Effect.Effect<void, OutboxError> =>
    Effect.gen(function* () {
      yield* Effect.promise(() => ready);
      if (readyFailure !== null) {
        return yield* outboxError("storage", readyFailure);
      }
    });

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

    status: () =>
      Effect.gen(function* () {
        const rows = yield* listAll();
        return statusOf(rows);
      }),

    watch: () =>
      table.watch({ direction: "next" }).pipe(
        Stream.map((rows) => statusOf(rows.map(toOutboxOp))),
        Stream.mapError(storageError),
      ),

    flush: () =>
      Effect.suspend(() => {
        if (active !== null) {
          return Effect.promise(() => active as Promise<OutboxFlushResult>);
        }

        const run = Effect.runPromise(
          awaitReady().pipe(Effect.andThen(drain())),
        );
        active = run;

        // The reset runs on both paths. The handler reads no value, so the
        // rejected promise of a failed flush does not become unhandled.
        const reset = () => {
          if (active === run) active = null;
        };
        void run.then(reset, reset);

        return Effect.promise(() => run);
      }),

    resume: () =>
      Effect.sync(() => {
        paused = false;
        signInRequired = false;
      }),
  };

  return { api, registry, ready };
}
