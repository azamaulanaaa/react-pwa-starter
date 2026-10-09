import { Effect, Queue, Schema, Stream } from "effect";

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
  // The schema is a struct, so the code can read its fields.
  schema: Schema.Codec<A, I> & Schema.Struct<Schema.Struct.Fields>;
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
  // v4 removed `Schema.omit`. The code rebuilds the struct without the
  // three fields that the worker supplies. `toType` keeps the input on the
  // decoded side, which is what the v3 `typeSchema` call did.
  const { id, created_at, modified_at, ...rest } = Schema.toType(schema)
    .schema.fields;
  const putSchema = Schema.toType(Schema.Struct(rest));

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

          // The stream element is the rows array, so the consumer receives one
          // batch per notification.
          return Stream.callback<A[], DbError>((queue) =>
            Effect.gen(function* () {
              let stopped = false;
              let generation = 0;

              const push = () => {
                const current = ++generation;

                Effect.runPromise(queryRows(params)).then(
                  (rows) => {
                    if (stopped || current !== generation) return;
                    Effect.runFork(Queue.offer(queue, rows));
                  },
                  (error) => {
                    if (stopped || current !== generation) return;
                    Effect.runFork(
                      Queue.fail(queue, new DbError({ error })),
                    );
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
                Queue.end(queue);
              });
            })
          );
        }),
      ),
  };
}
