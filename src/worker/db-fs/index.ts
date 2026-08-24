import { Effect } from "effect";
import { BTreeStore, type BTreeStore as BTreeStoreType } from "oxkv";
import type { FsError } from "@/worker/fs/error.ts";
import { type FileData, fs } from "@/worker/fs/index.ts";
import { DbError } from "@/worker/db/error.ts";
import type {
  DbEvent,
  EventBus,
  TableModule,
} from "@/worker/db/factory.ts";
import { exportStore, hydrateStore } from "@/worker/db/factory.ts";
import type { Id } from "@/worker/db/schema.ts";

const lift = <A>(
  effect: Effect.Effect<A, FsError>,
): Effect.Effect<A, DbError> =>
  Effect.mapError(effect, (error) => new DbError({ error }));

const decodeFile = (data: FileData): unknown =>
  JSON.parse(
    typeof data === "string" ? data : new TextDecoder().decode(data),
  );

export type FsPersistence = {
  save: (
    table: string,
    id: Id,
    doc: unknown,
  ) => Effect.Effect<void, DbError>;
  remove: (table: string, id: Id) => Effect.Effect<boolean, DbError>;
  load: (
    table: string,
  ) => Effect.Effect<{ id: Id; value: unknown }[], DbError>;
};

export function createFsPersistence(root = "db/main"): FsPersistence {
  return {
    save: (table, id, doc) =>
      lift(fs.writeFile(`${root}/${table}/${id}`, JSON.stringify(doc))),
    remove: (table, id) => lift(fs.deleteFile(`${root}/${table}/${id}`)),
    load: (table) =>
      Effect.gen(function* () {
        const ids = yield* lift(fs.listDir(`${root}/${table}`));

        return yield* Effect.forEach(ids, (id) =>
          Effect.gen(function* () {
            const raw = yield* lift(
              fs.readFile(`${root}/${table}/${id}`),
            );
            const value = yield* Effect.try({
              try: () => decodeFile(raw),
              catch: (error) => new DbError({ error }),
            });

            return { id, value };
          }));
      }),
  };
}

export function loadSnapshot(
  tables: string[],
  persistence: FsPersistence,
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
  persistence: FsPersistence;
  attach: (events: EventBus) => () => void;
  hydrate: (
    store: BTreeStoreType,
  ) => Effect.Effect<void, DbError>;
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

  const channel = new BroadcastChannel(`db-fs:${root}`);

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
  tables: Record<string, TableModule<string, any>>,
  root?: string,
): DbFs {
  const persistence = createFsPersistence(root);
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
