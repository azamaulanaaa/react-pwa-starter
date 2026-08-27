import { createStorage } from "unstorage";
import indexedDbDriver from "unstorage/drivers/indexedb";
import { Effect } from "effect";
import { BTreeStore, type BTreeStore as BTreeStoreType } from "oxkv";

import { DbError } from "@/worker/db/error.ts";
import type { DbEvent, EventBus, TableModule } from "@/worker/db/factory.ts";
import { exportStore, hydrateStore } from "@/worker/db/factory.ts";
import type { Id } from "@/worker/db/schema.ts";

const storage = createStorage({
  driver: indexedDbDriver({ dbName: "db" }),
});

export function openDbStore() {
  return Promise.resolve(storage);
}

export type DbPersistence = {
  save: (table: string, id: Id, doc: unknown) => Effect.Effect<void, DbError>;
  remove: (table: string, id: Id) => Effect.Effect<boolean, DbError>;
  load: (table: string) => Effect.Effect<{ id: Id; value: unknown }[], DbError>;
};

export function createDbPersistence(root = "db/main"): DbPersistence {
  const keyOf = (table: string, id: Id) => `${root}/${table}/${id}`;

  return {
    save: (table, id, doc) =>
      Effect.tryPromise({
        try: async () => {
          await storage.setItem(keyOf(table, id), JSON.stringify(doc));
        },
        catch: (error) => new DbError({ error }),
      }),
    remove: (table, id) =>
      Effect.gen(function* () {
        const key = keyOf(table, id);
        const existing = yield* Effect.tryPromise({
          try: () => storage.getItem(key),
          catch: (error) => new DbError({ error }),
        });

        if (existing == null) {
          return false;
        }

        yield* Effect.tryPromise({
          try: () => storage.removeItem(key),
          catch: (error) => new DbError({ error }),
        });

        return true;
      }),
    load: (table) =>
      Effect.gen(function* () {
        const prefix = `${root}/${table}/`;
        const keys = yield* Effect.tryPromise({
          try: () => storage.getKeys(prefix),
          catch: (error) => new DbError({ error }),
        });

        return yield* Effect.forEach(keys, (key) =>
          Effect.gen(function* () {
            const raw = yield* Effect.tryPromise({
              try: () => storage.getItem(key),
              catch: (error) => new DbError({ error }),
            });
            const value = yield* Effect.succeed(raw);

            return { id: key.slice(prefix.length) as Id, value };
          }));
      }),
  };
}

export function loadSnapshot(
  tables: string[],
  persistence: DbPersistence,
): Effect.Effect<Uint8Array, DbError> {
  return Effect.gen(function* () {
    const temp = new BTreeStore();
    yield* Effect.forEach(tables, (table) =>
      Effect.gen(function* () {
        const rows = yield* persistence.load(table);
        yield* Effect.forEach(rows, ({ id, value }) =>
          Effect.tryPromise({
            try: () => temp.set(`${table}:${id}`, value),
            catch: (error) => new DbError({ error }),
          }));
      }));

    return yield* exportStore(temp);
  });
}

export type DbFs = {
  persistence: DbPersistence;
  attach: (events: EventBus) => () => void;
  hydrate: (store: BTreeStoreType) => Effect.Effect<void, DbError>;
};

export type PeerSync = {
  publish: (event: DbEvent) => void;
  subscribe: (handler: (event: DbEvent) => void) => () => void;
};

export function createPeerSync(root = "db/main"): PeerSync {
  if (typeof BroadcastChannel === "undefined") {
    return {
      publish: () => {},
      subscribe: () => () => {},
    };
  }

  const channel = new BroadcastChannel(`db:${root}`);

  return {
    publish: (event) => channel.postMessage(event),
    subscribe: (handler) => {
      channel.onmessage = (message) => handler(message.data as DbEvent);

      return () => {
        channel.onmessage = null;
      };
    },
  };
}

export function createDbFs(
  // deno-lint-ignore no-explicit-any
  tables: Record<string, TableModule<string, any>>,
  root?: string,
): DbFs {
  const persistence = createDbPersistence(root);
  const tableNames = Object.values(tables).map((table) => table.name);

  return {
    persistence,
    attach: (events) =>
      events.subscribe((event) =>
        event.kind === "set"
          ? persistence.save(event.table, event.id, event.doc)
          : persistence.remove(event.table, event.id)
      ),
    hydrate: (store) =>
      Effect.flatMap(
        loadSnapshot(tableNames, persistence),
        (snapshot) => hydrateStore(store, snapshot),
      ),
  };
}

// Back-compat alias — remove after migration
export type FsPersistence = DbPersistence;
export const createFsPersistence = createDbPersistence;
