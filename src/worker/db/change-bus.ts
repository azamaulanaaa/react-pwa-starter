import { Effect } from "effect";
import { Atom, AtomRegistry, Reactivity } from "effect/reactivity";

import type { Id } from "@/worker/db/schema.ts";
import { DbError } from "@/worker/db/error.ts";

export type ChangeBus = {
  subscribe: (tableName: string, listener: () => void) => () => void;
  notify: (tableName: string) => void;
};

/**
 * The bus holds one `Reactivity` instance. The table name is the invalidation
 * key, so the bus does not keep a map of table names to listeners.
 */
export function createChangeBus(): ChangeBus {
  const reactivity = Effect.runSync(Reactivity.make);

  return {
    subscribe: (tableName, listener) =>
      reactivity.registerUnsafe([tableName], listener),
    notify: (tableName) => reactivity.invalidateUnsafe([tableName]),
  };
}

export type DbSetEvent = {
  kind: "set";
  table: string;
  id: Id;
  doc: unknown;
};

export type DbDeleteEvent = {
  kind: "delete";
  table: string;
  id: Id;
};

export type DbEvent = DbSetEvent | DbDeleteEvent;

export type EventHandler = (event: DbEvent) => Effect.Effect<void, DbError>;

/**
 * The bus holds the event handlers in one atom. The atom gives every reader
 * the current handler set, so `emit` runs the handlers that are registered
 * when it starts.
 */
export function createEventBus() {
  const registry = AtomRegistry.make();
  // The atom stays cached, so the handlers survive the gap between the
  // subscription and the next emit.
  const handlers = Atom.keepAlive(Atom.make(new Set<EventHandler>()));

  return {
    subscribe(handler: EventHandler): () => void {
      registry.update(handlers, (current) => new Set(current).add(handler));

      return () => {
        registry.update(handlers, (current) => {
          const next = new Set(current);
          next.delete(handler);
          return next;
        });
      };
    },
    emit(event: DbEvent): Effect.Effect<void, DbError> {
      return Effect.forEach(
        [...registry.get(handlers)],
        (handler) => handler(event),
        { discard: true },
      );
    },
  };
}

export type EventBus = ReturnType<typeof createEventBus>;
