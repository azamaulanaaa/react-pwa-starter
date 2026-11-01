import { Effect, Ref } from "effect";

import type { OutboxHandler } from "@/lib/outbox/types.ts";
import { outboxError, type OutboxError } from "@/worker/outbox/error.ts";

// The handler map is separate from the records, so registration and dispatch
// are testable without a flusher.
export type OutboxRegistry = {
  readonly register: (
    kind: string,
    handler: OutboxHandler,
  ) => Effect.Effect<void, OutboxError, never>;
  readonly has: (kind: string) => Effect.Effect<boolean, OutboxError, never>;
  readonly lookup: (
    kind: string,
  ) => Effect.Effect<OutboxHandler, OutboxError, never>;
  readonly kinds: () => Effect.Effect<string[], OutboxError, never>;
};

const decodeKind = (kind: string): Effect.Effect<string, OutboxError> =>
  kind.trim() === ""
    ? Effect.fail(
        outboxError("invalid_input", "The handler kind must not be empty."),
      )
    : Effect.succeed(kind);

export const createRegistry = (): Effect.Effect<OutboxRegistry> =>
  Ref.make(new Map<string, OutboxHandler>()).pipe(
    Effect.map((handlers) => ({
      // Registering a kind twice replaces the handler, so a module reload does
      // not leave a stale handler behind.
      register: (kind, handler) =>
        Effect.flatMap(decodeKind(kind), (validKind) =>
          Ref.update(handlers, (current) =>
            new Map(current).set(validKind, handler),
          ),
        ),
      has: (kind) =>
        Effect.flatMap(decodeKind(kind), (validKind) =>
          Effect.map(Ref.get(handlers), (current) => current.has(validKind)),
        ),
      // An unknown kind fails here, at dispatch, so the message names the kind
      // the caller asked for.
      lookup: (kind) =>
        Effect.flatMap(decodeKind(kind), (validKind) =>
          Effect.flatMap(Ref.get(handlers), (current) => {
            const handler = current.get(validKind);
            return handler === undefined
              ? Effect.fail(
                  outboxError(
                    "unknown_kind",
                    `No handler is registered for kind '${validKind}'.`,
                  ),
                )
              : Effect.succeed(handler);
          }),
        ),
      kinds: () =>
        Effect.map(Ref.get(handlers), (current) => [...current.keys()]),
    })),
  );
