import { Effect, Ref } from "effect";

import { type QueueError, queueError } from "@/worker/queue/error.ts";
import { decodeUnknownFx } from "@/worker/queue/helpers.ts";
import { type JobHandler, JobKindSchema } from "@/worker/queue/schema.ts";

// The handler map is separate from the records, so registration and dispatch
// are testable without a scheduler.
export type JobRegistry = {
  readonly register: (
    kind: string,
    handler: JobHandler,
  ) => Effect.Effect<void, QueueError, never>;
  readonly has: (kind: string) => Effect.Effect<boolean, QueueError, never>;
  readonly lookup: (
    kind: string,
  ) => Effect.Effect<JobHandler, QueueError, never>;
  readonly kinds: () => Effect.Effect<string[], QueueError, never>;
};

export const createRegistry = (): Effect.Effect<JobRegistry> =>
  Ref.make(new Map<string, JobHandler>()).pipe(
    Effect.map((handlers) => ({
      // Registering a kind twice replaces the handler, so a module reload does
      // not leave a stale handler behind.
      register: (kind, handler) =>
        Effect.gen(function* () {
          const vKind = yield* decodeUnknownFx(JobKindSchema, kind);
          yield* Ref.update(handlers, (current) =>
            new Map(current).set(vKind, handler),
          );
        }),
      has: (kind) =>
        Effect.gen(function* () {
          const vKind = yield* decodeUnknownFx(JobKindSchema, kind);
          return (yield* Ref.get(handlers)).has(vKind);
        }),
      // An unknown kind fails here, at dispatch, so the message names the kind
      // the caller asked for.
      lookup: (kind) =>
        Effect.gen(function* () {
          const vKind = yield* decodeUnknownFx(JobKindSchema, kind);
          const handler = (yield* Ref.get(handlers)).get(vKind);
          if (handler === undefined) {
            return yield* queueError(
              "unknown_kind",
              `No handler is registered for kind '${vKind}'.`,
            );
          }
          return handler;
        }),
      kinds: () =>
        Ref.get(handlers).pipe(Effect.map((current) => [...current.keys()])),
    })),
  );
