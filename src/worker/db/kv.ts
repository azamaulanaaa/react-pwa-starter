import { Effect, Schema, Struct } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
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

// A non-negative integer. v4 has no `Schema.NonNegativeInt`.
const NonNegativeInt = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);

export const ListParamsSchema = Schema.Struct({
  limit: Schema.optional(NonNegativeInt),
  direction: Schema.Literals(["next", "prev"]),
  startCursor: Schema.optional(Schema.NonEmptyString),
  endCursor: Schema.optional(Schema.NonEmptyString),
});
export type ListParams = Schema.Schema.Type<typeof ListParamsSchema>;

export const KvListParamsSchema = ListParamsSchema.mapFields(
  Struct.assign(Schema.Struct({
    query: Schema.optional(Schema.String),
  }).fields),
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

  // A write invalidates the table that owns the key.
  // The key carries the table name, so the split stays the identity step.
  const invalidateKey = (key: string) => {
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

        invalidateKey(key);
      }),
    delete: (key) =>
      Effect.gen(function* () {
        const store = yield* openFx();
        const removed = yield* fromPromise(
          () => store.delete(key) as Promise<boolean>,
        );

        if (removed) {
          invalidateKey(key);
        }

        return removed;
      }),
    exists: (key) =>
      Effect.gen(function* () {
        const store = yield* openFx();
        return yield* fromPromise(
          () => store.has(key) as Promise<boolean>,
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

        // The staged table names live in an atom, so the commit reads the
        // tables that the transaction changed. The atom stays cached, so the
        // staged names survive the gap before the commit.
        const registry = AtomRegistry.make();
        const dirtyTables = Atom.keepAlive(Atom.make(new Set<string>()));

        const markDirty = (key: string) => {
          const tableName = tableOfKey(key);
          if (tableName !== undefined) {
            registry.update(dirtyTables, (current) =>
              new Set(current).add(tableName));
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
            fromPromise(() => tx.has(key) as Promise<boolean>),
          commit: () =>
            Effect.gen(function* () {
              yield* fromPromise(() => tx.commit());

              for (const tableName of registry.get(dirtyTables)) {
                bus.notify(tableName);
              }
            }),
          rollback: () => fromPromise(() => tx.rollback()),
        } satisfies KvTx;
      }),
  };
}
