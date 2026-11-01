import { Effect } from "effect";

import type { OutboxLocalChange, OutboxOp } from "@/lib/outbox/types.ts";
import type { TableModule } from "@/worker/db/factory.ts";
import type { DbEvent } from "@/worker/db/factory.ts";
import type { DbError } from "@/worker/db/error.ts";
import { KvApi, tableKeys, type KvTx } from "@/worker/db/kv.ts";
import { createTableApi } from "@/worker/db/table.ts";
import {
  OutboxRecordSchema,
  type OutboxRecord,
  type OutboxRecordEncoded,
} from "@/worker/outbox/schema.ts";

const OUTBOX_TABLE = "outbox";

export type OutboxTableApi = ReturnType<
  typeof createTableApi<"outbox", OutboxRecord, OutboxRecordEncoded>
> & {
  /**
   * Writes the outbox record and the local changes in one transaction.
   * The function emits the persistence events after the commit.
   */
  append: (
    op: OutboxOp,
    local: readonly OutboxLocalChange[],
  ) => Effect.Effect<void, DbError>;
  /**
   * Removes the outbox record and applies the local changes in one transaction.
   * The function returns true when it removed the record.
   */
  complete: (
    id: string,
    local: readonly OutboxLocalChange[],
  ) => Effect.Effect<boolean, DbError>;
};

function outboxDoc(op: OutboxOp, nowIso: string) {
  return {
    id: op.id,
    kind: op.kind,
    method: op.method,
    path: op.path,
    body: op.body,
    createdAt: op.createdAt,
    attempts: op.attempts,
    nextAttemptAt: op.nextAttemptAt,
    state: op.state,
    ...(op.lastError === undefined ? {} : { lastError: op.lastError }),
    created_at: nowIso,
    modified_at: nowIso,
  };
}

function writeLocal(
  tx: KvTx,
  change: OutboxLocalChange,
  nowIso: string,
): Effect.Effect<DbEvent | null, DbError> {
  return Effect.gen(function* () {
    const key = tableKeys(change.table).of(change.id);

    if (change.kind === "delete") {
      const removed = yield* tx.delete(key);
      return removed
        ? { kind: "delete", table: change.table, id: change.id }
        : null;
    }

    const current = yield* tx.get(key);
    const previous =
      current !== null && typeof current === "object"
        ? (current as Record<string, unknown>)
        : undefined;
    const value =
      change.value !== null && typeof change.value === "object"
        ? (change.value as Record<string, unknown>)
        : {};
    const doc = {
      ...value,
      id: change.id,
      created_at: previous?.created_at ?? nowIso,
      modified_at: nowIso,
    };

    yield* tx.set(key, doc);
    return { kind: "set", table: change.table, id: change.id, doc };
  });
}

function emitEvents(
  emit: (event: DbEvent) => Effect.Effect<void, DbError>,
  events: readonly (DbEvent | null)[],
): Effect.Effect<void, DbError> {
  return Effect.forEach(
    events.filter((event): event is DbEvent => event !== null),
    (event) => emit(event),
    { discard: true },
  );
}

/**
 * Defines the outbox system table.
 * The table keeps one row for each operation that waits for the network.
 */
export const TableOutbox: TableModule<"outbox", OutboxTableApi> = {
  name: OUTBOX_TABLE,
  schema: OutboxRecordSchema,
  api: (ctx) => {
    const table = createTableApi({
      tableName: OUTBOX_TABLE,
      schema: OutboxRecordSchema,
      kvLayer: ctx.kvLayer,
      subscribe: ctx.subscribe,
      emit: ctx.emit,
    });

    const withKv = <A, E>(effect: Effect.Effect<A, E, KvApi>) =>
      Effect.provide(effect, ctx.kvLayer);

    const append: OutboxTableApi["append"] = (op, local) =>
      withKv(
        Effect.gen(function* () {
          const kv = yield* KvApi;
          const tx = yield* kv.beginTx();
          const nowIso = new Date(op.createdAt).toISOString();
          const key = tableKeys(OUTBOX_TABLE).of(op.id);
          const doc = outboxDoc(op, nowIso);
          const events: (DbEvent | null)[] = [
            {
              kind: "set",
              table: OUTBOX_TABLE,
              id: op.id,
              doc,
            },
          ];

          yield* tx.set(key, doc);

          for (const change of local) {
            events.push(yield* writeLocal(tx, change, nowIso));
          }

          yield* tx.commit();
          yield* emitEvents(ctx.emit, events);
        }),
      );

    const complete: OutboxTableApi["complete"] = (id, local) =>
      withKv(
        Effect.gen(function* () {
          const kv = yield* KvApi;
          const tx = yield* kv.beginTx();
          const nowIso = new Date().toISOString();
          const key = tableKeys(OUTBOX_TABLE).of(id);
          const removed = yield* tx.delete(key);
          const events: (DbEvent | null)[] = [];

          for (const change of local) {
            events.push(yield* writeLocal(tx, change, nowIso));
          }

          yield* tx.commit();

          yield* emitEvents(
            ctx.emit,
            removed
              ? [{ kind: "delete", table: OUTBOX_TABLE, id }, ...events]
              : events,
          );

          return removed;
        }),
      );

    return { ...table, append, complete };
  },
};
