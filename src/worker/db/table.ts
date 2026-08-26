import { Chunk, Effect, Option, Schema, Stream } from "effect";

import type { ChangeBus, DbEvent } from "@/worker/db/change-bus.ts";
import { DbError } from "@/worker/db/error.ts";
import { decodeFx, decodeUnknownFx } from "@/worker/db/helpers.ts";
import {
  type KvApi,
  type ListParams,
  ListParamsSchema,
  tableKeys,
} from "@/worker/db/kv.ts";
import { type Base, IdSchema } from "@/worker/db/schema.ts";

type TableDeps<Name extends string, A extends Base, I> = {
  tableName: Name;
  schema: Schema.Schema<A, I, never>;
  kv: KvApi;
  subscribe: ChangeBus["subscribe"];
  emit: (event: DbEvent) => Effect.Effect<void, DbError>;
};

export function createTableApi<Name extends string, A extends Base, I>({
  tableName,
  schema,
  kv,
  subscribe,
  emit,
}: TableDeps<Name, A, I>) {
  const putSchema = Schema.typeSchema(schema).pipe(
    Schema.omit("id", "created_at", "modified_at"),
  );

  const decodeId = (id: string) => decodeFx(IdSchema, id);

  const decodeDoc = (value: unknown) => decodeUnknownFx(schema, value);

  const keys = tableKeys(tableName);

  function queryRows(params: ListParams) {
    return Effect.gen(function* () {
      const isPrev = params.direction === "prev";

      let startCursor = isPrev ? keys.upperBound : keys.lowerBound;
      let endCursor: string | undefined = isPrev ? undefined : keys.upperBound;
      let minKey: string | undefined;

      if (params.startCursor && params.endCursor) {
        if (isPrev) {
          startCursor = keys.of(params.endCursor);
          minKey = keys.of(params.startCursor);
        } else {
          startCursor = keys.of(params.startCursor);
          endCursor = keys.of(params.endCursor);
        }
      } else if (params.startCursor) {
        startCursor = keys.of(params.startCursor);
      }

      const entries = yield* kv.gets({
        limit: params.limit,
        direction: params.direction,
        startCursor,
        endCursor,
      });

      return yield* Effect.forEach(
        entries.filter((entry) =>
          keys.includes(entry.key) &&
          (minKey === undefined || entry.key >= minKey)
        ),
        (entry) => decodeDoc(entry.value),
      );
    });
  }

  return {
    exists: (id: string) =>
      Effect.gen(function* () {
        const decodedId = yield* decodeId(id);

        return yield* kv.exists(keys.of(decodedId));
      }),
    get: (id: string) =>
      Effect.gen(function* () {
        const decodedId = yield* decodeId(id);

        const data = yield* kv.get(keys.of(decodedId));

        if (data == null) {
          return yield* Effect.fail(
            new DbError({
              error: `${
                String(tableName)
              } item with ID '${decodedId}' not found`,
            }),
          );
        }

        return yield* decodeDoc(data);
      }),
    set: (id: string, input: Schema.Schema.Type<typeof putSchema>) =>
      Effect.gen(function* () {
        const decodedId = yield* decodeId(id);
        const decodedInput = yield* decodeUnknownFx(putSchema, input);

        const key = keys.of(decodedId);

        const old = yield* kv.get(key) as Effect.Effect<
          Record<string, unknown> | null,
          DbError
        >;

        const now = new Date().toISOString();
        const doc = {
          ...decodedInput,
          id: decodedId,
          created_at: old?.created_at ?? now,
          modified_at: now,
        };

        yield* kv.set(key, doc);

        yield* emit({ kind: "set", table: tableName, id: decodedId, doc });
      }),
    delete: (id: string) =>
      Effect.gen(function* () {
        const decodedId = yield* decodeId(id);

        const removed = yield* kv.delete(keys.of(decodedId));

        if (removed) {
          yield* emit({ kind: "delete", table: tableName, id: decodedId });
        }

        return removed;
      }),
    watch: (args: ListParams) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const params = yield* decodeFx(ListParamsSchema, args);

          return Stream.async<A[], DbError>((emit) => {
            let stopped = false;
            let generation = 0;

            const push = () => {
              const current = ++generation;

              Effect.runPromise(queryRows(params)).then(
                (rows) => {
                  if (stopped || current !== generation) return;
                  emit(Effect.succeed(Chunk.of(rows)));
                },
                (error) => {
                  if (stopped || current !== generation) return;
                  emit(Effect.fail(Option.some(new DbError({ error }))));
                },
              );
            };

            push();

            const unsubscribe = subscribe(tableName, () => {
              if (!stopped) push();
            });

            return Effect.sync(() => {
              stopped = true;
              unsubscribe();
            });
          });
        }),
      ),
  };
}
