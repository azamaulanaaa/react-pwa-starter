import { Chunk, Effect, Option, Schema, Stream } from "effect";
import { Dexie, type EntityTable, liveQuery } from "dexie";
import { v7 as randomUUID } from "uuid";

import { DbError } from "@/worker/db/error.ts";

export type ApiFunction<Args extends any[], A, E> = (
  ...args: Args
) => Effect.Effect<A, E, never> | Stream.Stream<A, E, never>;

export type TableModule<
  Entity extends Record<string, any>,
  Name extends string,
  Api extends Record<string, ApiFunction<any, any, any>>,
> = {
  name: Name;
  indexes: "id";
  api: (
    db: Dexie & { [K in Name]: EntityTable<Entity, "id"> },
  ) => Api;
};

type ExtractTableShape<T> = T extends TableModule<infer Entity, infer Name, any>
  ? { [K in Name]: EntityTable<Entity, "id"> }
  : never;

type ExtractApiShape<T> = T extends
  { name: infer Name extends string; api: (db: any) => infer Api }
  ? { [K in Name]: Api }
  : never;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends
  (k: infer I) => void ? I
  : never;

export const StreamParamSchema = Schema.Struct({
  limit: Schema.optional(Schema.NonNegativeInt),
  direction: Schema.Literal("next", "prev"),
  startCursor: Schema.optional(Schema.NonEmptyString),
  endCursor: Schema.optional(Schema.NonEmptyString),
});
export type StreamParam = Schema.Schema.Type<typeof StreamParamSchema>;

export const IdSchema = Schema.NonEmptyString;
export type Id = Schema.Schema.Type<typeof IdSchema>;

export const BaseSchema = Schema.Struct({
  id: IdSchema,
  created_at: Schema.DateFromSelf,
  modified_at: Schema.DateFromSelf,
});
export type Base = Schema.Schema.Type<typeof BaseSchema>;

export const createTableModule =
  <Name extends string, A extends Base, I, R>(config: {
    name: Name;
    schema: Schema.Schema<A, I, R>;
    idFactory?: () => string;
  }) =>
  <
    CustomApi extends Record<string, ApiFunction<any, any, any>> = {},
  >(
    moduleConfig?: {
      extensions?: (
        db: Dexie & { [K in Name]: EntityTable<A, "id"> },
        crud: ReturnType<typeof generateCrud<Name, A, I, R>>,
      ) => CustomApi;
    },
  ): TableModule<
    A,
    Name,
    ReturnType<typeof generateCrud<Name, A, I, R>> & CustomApi
  > => {
    const finalIdFactory = config.idFactory ?? (() => randomUUID());

    return {
      name: config.name,
      indexes: "id",
      api: (db) => {
        const crud = generateCrud(
          db,
          config.name,
          config.schema,
          finalIdFactory,
        );
        const customApi = moduleConfig?.extensions
          ? moduleConfig.extensions(db, crud)
          : ({} as CustomApi);

        return {
          ...crud,
          ...customApi,
        };
      },
    };
  };

function generateCrud<
  Name extends string,
  A extends Base,
  I,
  R,
>(
  db: Dexie & { [K in Name]: EntityTable<A, "id"> },
  tableName: Name,
  schema: Schema.Schema<A, I, R>,
  idFactory: () => string,
) {
  const table = db[tableName];
  const outputSchema = Schema.typeSchema(schema);

  const InsertSchema = outputSchema.pipe(
    Schema.omit("id", "created_at", "modified_at"),
    Schema.extend(Schema.Struct({ id: Schema.optional(Schema.String) })),
  );

  const UpdateSchema = Schema.partial(
    outputSchema.pipe(Schema.omit("id", "created_at", "modified_at")),
  );

  return {
    getById: (id: Id) =>
      Effect.gen(function* () {
        const vId = yield* Schema.decode(IdSchema)(id).pipe(
          Effect.mapError((error) => new DbError({ error })),
        );

        const data = yield* Effect.tryPromise({
          try: () => table.get(vId as any),
          catch: (error) => new DbError({ error }),
        });

        if (data == null) {
          return yield* Effect.fail(
            new DbError({
              error: `${String(tableName)} item with ID '${id}' not found`,
            }),
          );
        }

        return data;
      }),
    deleteById: (id: Id) =>
      Effect.gen(function* () {
        const vId = yield* Schema.decode(IdSchema)(id).pipe(
          Effect.mapError((error) => new DbError({ error })),
        );

        yield* Effect.tryPromise({
          try: () => table.delete(vId as any),
          catch: (error) => new DbError({ error }),
        });

        return true;
      }),
    updateById: (
      id: Id,
      property: Schema.Schema.Type<typeof UpdateSchema>,
    ) =>
      Effect.gen(function* () {
        const { id: vId, property: vProperty } = yield* Schema.decode(
          Schema.Struct({ id: IdSchema, property: UpdateSchema }),
        )({ id, property }).pipe(
          Effect.mapError((error) => new DbError({ error })),
        );

        yield* Effect.tryPromise({
          try: () =>
            table.update(vId as any, (old) => {
              if (!old) return;
              Object.assign(old, vProperty, {
                modified_at: new Date(),
              });
            }),
          catch: (error) => new DbError({ error }),
        });

        return true;
      }),
    insertOne: (
      property: Schema.Schema.Type<typeof InsertSchema>,
    ) =>
      Effect.gen(function* () {
        const vPropery = yield* Schema.decode(InsertSchema)(property).pipe(
          Effect.mapError((error) => new DbError({ error })),
        );

        const now = new Date();
        const finalId = vPropery.id ?? idFactory();

        yield* Effect.tryPromise({
          try: () =>
            table.add({
              ...vPropery,
              id: finalId,
              created_at: now,
              modified_at: now,
            } as A),
          catch: (error) => new DbError({ error }),
        });

        return finalId;
      }),
    stream: (args: StreamParam) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const { limit, direction, startCursor, endCursor } = yield* Schema
            .decode(StreamParamSchema)(args).pipe(
              Effect.mapError((error) => new DbError({ error })),
            );

          return Stream.async<A[], DbError>((emit) => {
            const observable = liveQuery(() => {
              let collection;

              if (startCursor && endCursor) {
                collection = table.where("id").between(
                  startCursor,
                  endCursor,
                  true,
                  true,
                );
              } else if (startCursor) {
                collection = direction === "next"
                  ? table.where("id").aboveOrEqual(startCursor)
                  : table.where("id").belowOrEqual(startCursor);
              } else {
                collection = table.toCollection();
              }

              if (direction === "prev") {
                collection = collection.reverse();
              }

              if (limit) {
                collection = collection.limit(limit);
              }

              return collection.toArray();
            });

            const subscription = observable.subscribe({
              next: (data) => emit(Effect.succeed(Chunk.of(data))),
              error: (error) =>
                emit(Effect.fail(Option.some(new DbError({ error })))),
            });

            return Effect.sync(() => subscription.unsubscribe());
          });
        }),
      ),
  };
}

type GetModuleValues<T> = T extends Record<string, infer M>
  ? M extends TableModule<any, any, any> ? M : never
  : never;

export function createDatabase<
  T extends Record<string, TableModule<any, any, any>>,
>(
  name: string,
  tables: T,
) {
  type ModuleUnion = GetModuleValues<T>;
  type DexieDatabase =
    & Dexie
    & UnionToIntersection<ExtractTableShape<ModuleUnion>>;

  const dexieInstance = new Dexie(name) as DexieDatabase;

  const modules = Object.values(tables);

  dexieInstance.version(1).stores(
    Object.fromEntries(
      modules.map((mod) => [mod.name, mod.indexes]),
    ),
  );

  return Object.fromEntries(
    modules.map((mod) => [mod.name, mod.api(dexieInstance as any)]),
  ) as UnionToIntersection<ExtractApiShape<ModuleUnion>>;
}
