import { Effect } from "effect";

import type { Id } from "@/worker/db/schema.ts";
import { DbError } from "@/worker/db/error.ts";

export type ChangeBus = {
  subscribe: (tableName: string, listener: () => void) => () => void;
  notify: (tableName: string) => void;
};

export function createChangeBus(): ChangeBus {
  const listeners = new Map<string, Set<() => void>>();

  return {
    subscribe(tableName, listener) {
      let bucket = listeners.get(tableName);
      if (!bucket) {
        bucket = new Set();
        listeners.set(tableName, bucket);
      }
      bucket.add(listener);

      return () => {
        bucket.delete(listener);
      };
    },
    notify(tableName) {
      for (const listener of listeners.get(tableName) ?? []) {
        listener();
      }
    },
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

export function createEventBus() {
  const handlers = new Set<EventHandler>();

  return {
    subscribe(handler: EventHandler): () => void {
      handlers.add(handler);

      return () => {
        handlers.delete(handler);
      };
    },
    emit(event: DbEvent): Effect.Effect<void, DbError> {
      return Effect.forEach([...handlers], (handler) => handler(event), {
        discard: true,
      });
    },
  };
}

export type EventBus = ReturnType<typeof createEventBus>;
