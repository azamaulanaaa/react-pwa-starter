import { Effect, Schema } from "effect";
import { type BTreeStore, type BTreeTx, Direction } from "oxkv";

import type { ChangeBus } from "@/worker/db/change-bus.ts";
import { DbError } from "@/worker/db/error.ts";
import { decodeFx, fromPromise } from "@/worker/db/helpers.ts";

export type KvEntry = {
  key: string;
  value: unknown;
};

export type KvTx = {
  get: (key: string) => Effect.Effect<unknown, DbError>;
  set: (key: string, value: unknown) => Effect.Effect<void, DbError>;
  delete: (key: string) => Effect.Effect<boolean, DbError>;
  exists: (key: string) => Effect.Effect<boolean, DbError>;
  commit: () => Effect.Effect<void, DbError>;
  rollback: () => Effect.Effect<void, DbError>;
};

export type KvApi = {
  get: (key: string) => Effect.Effect<unknown, DbError>;
  set: (key: string, value: unknown) => Effect.Effect<void, DbError>;
  delete: (key: string) => Effect.Effect<boolean, DbError>;
  exists: (key: string) => Effect.Effect<boolean, DbError>;
  gets: (args: KvListParams) => Effect.Effect<KvEntry[], DbError>;
  load: (data: Uint8Array) => Effect.Effect<number, DbError>;
  save: () => Effect.Effect<Uint8Array, DbError>;
  beginTx: () => Effect.Effect<KvTx, DbError>;
};

export const ListParamsSchema = Schema.Struct({
  limit: Schema.optional(Schema.NonNegativeInt),
  direction: Schema.Literal("next", "prev"),
  startCursor: Schema.optional(Schema.NonEmptyString),
  endCursor: Schema.optional(Schema.NonEmptyString),
});
export type ListParams = Schema.Schema.Type<typeof ListParamsSchema>;

export const KvListParamsSchema = ListParamsSchema.pipe(
  Schema.extend(Schema.Struct({
    query: Schema.optional(Schema.String),
  })),
);
export type KvListParams = Schema.Schema.Type<typeof KvListParamsSchema>;

const PREFIX_UPPER_BOUND = "\uffff";

export function tableKeys(tableName: string) {
  const prefix = `${tableName}:`;

  return {
    of: (id: string) => `${prefix}${id}`,
    lowerBound: prefix,
    upperBound: `${prefix}${PREFIX_UPPER_BOUND}`,
    includes: (key: string) => key.startsWith(prefix),
  };
}

export const tableOfKey = (key: string): string | undefined => {
  const separatorIndex = key.indexOf(":");
  return separatorIndex > 0 ? key.slice(0, separatorIndex) : undefined;
};

type KvDeps = {
  open: () => Promise<BTreeStore>;
  bus: ChangeBus;
};

export function createKvApi({ open, bus }: KvDeps): KvApi {
  const openFx = () => fromPromise(open);

  const directionOf = (params: ListParams) =>
    params.direction === "prev" ? Direction.Prev : Direction.Next;

  const notifyKey = (key: string) => {
    const tableName = tableOfKey(key);
    if (tableName !== undefined) {
      bus.notify(tableName);
    }
  };

  return {
    get: (key) =>
      Effect.gen(function* () {
        const store = yield* openFx();
        return yield* fromPromise(() => store.get(key));
      }),
    set: (key, value) =>
      Effect.gen(function* () {
        const store = yield* openFx();
        yield* fromPromise(() => store.set(key, value));

        notifyKey(key);
      }),
    delete: (key) =>
      Effect.gen(function* () {
        const store = yield* openFx();
        const removed = yield* fromPromise(
          () => store.delete(key) as Promise<boolean>,
        );

        if (removed) {
          notifyKey(key);
        }

        return removed;
      }),
    exists: (key) =>
      Effect.gen(function* () {
        const store = yield* openFx();
        return yield* fromPromise(
          () => store.exists(key) as Promise<boolean>,
        );
      }),
    gets: (args) =>
      Effect.gen(function* () {
        const params = yield* decodeFx(KvListParamsSchema, args);
        const store = yield* openFx();
        return yield* fromPromise(() =>
          store.gets(
            params.limit ?? null,
            directionOf(params),
            params.startCursor ?? null,
            params.endCursor ?? null,
            params.query ?? null,
          ) as Promise<KvEntry[]>
        );
      }),
    load: (data) =>
      Effect.gen(function* () {
        const store = yield* openFx();
        return yield* fromPromise(() => store.load(data) as Promise<number>);
      }),
    save: () =>
      Effect.gen(function* () {
        const store = yield* openFx();
        return yield* fromPromise(() => store.save() as Promise<Uint8Array>);
      }),
    beginTx: () =>
      Effect.gen(function* () {
        const store = yield* openFx();
        const tx = yield* fromPromise(
          () => store.begin_tx() as Promise<BTreeTx>,
        );

        const dirtyTables = new Set<string>();

        const markDirty = (key: string) => {
          const tableName = tableOfKey(key);
          if (tableName !== undefined) {
            dirtyTables.add(tableName);
          }
        };

        return {
          get: (key) => fromPromise(() => tx.get(key)),
          set: (key, value) =>
            Effect.gen(function* () {
              yield* fromPromise(() => tx.set(key, value));

              markDirty(key);
            }),
          delete: (key) =>
            Effect.gen(function* () {
              const removed = yield* fromPromise(
                () => tx.delete(key) as Promise<boolean>,
              );

              if (removed) {
                markDirty(key);
              }

              return removed;
            }),
          exists: (key) =>
            fromPromise(() => tx.exists(key) as Promise<boolean>),
          commit: () =>
            Effect.gen(function* () {
              yield* fromPromise(() => tx.commit());

              for (const tableName of dirtyTables) {
                bus.notify(tableName);
              }
            }),
          rollback: () => fromPromise(() => tx.rollback()),
        } satisfies KvTx;
      }),
  };
}
