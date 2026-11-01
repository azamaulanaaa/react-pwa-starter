import { Effect, type Layer, Schema } from "effect";

import type { ChangePage, ChangeRow } from "@/lib/sync/changes.ts";
import { DbError } from "@/worker/db/error.ts";
import type { DbEvent, TableModule, TableSchema } from "@/worker/db/factory.ts";
import { decodeUnknownFx } from "@/worker/db/helpers.ts";
import { KvApi, tableKeys } from "@/worker/db/kv.ts";
import {
  type Quarantine,
  QuarantineSchema,
  quarantineKeys,
  SyncStateSchema,
  type SyncState,
  syncStateKeys,
} from "@/worker/db/system.ts";

/** Defines the input for one apply call. */
export interface ApplyChangePageInput {
  /** The server feed scope. */
  scope: string;
  /** The exclusive cursor that the caller used for this page. */
  since: number;
  /** The page that the transport returned. */
  page: ChangePage;
}

/** Defines the result of one apply call. */
export type ApplyChangePageResult =
  | {
      /** The page is applied and the cursor is stored. */
      status: "applied";
      /** The stored cursor. It matches the page `next` value. */
      cursor: number;
      /** The live row count that the page applied. */
      applied: number;
      /** The tombstone count that the page applied. */
      deleted: number;
      /** The row count that the page quarantined. */
      quarantined: number;
    }
  | {
      /** The cursor is below the server retention floor. */
      status: "resync_required";
      /** The stable failure reason. */
      reason: "resync_required";
      /** The server retention floor. */
      oldestSeq: number;
    }
  | {
      /**
       * The page does not advance the cursor.
       * The result is a value, not an error, so the caller can stop the loop.
       */
      status: "rejected";
      /** The stable failure reason. */
      reason: "cursor_not_advanced";
    };

/** Defines the change apply service that the worker exposes. */
export interface ChangeApplier {
  /** Applies one page in one transaction. */
  applyPage(
    input: ApplyChangePageInput,
  ): Effect.Effect<ApplyChangePageResult, DbError>;
  /** Reads the stored state for one scope. */
  state(scope: string): Effect.Effect<SyncState | null, DbError>;
}

/** Defines the options for the change applier. */
export interface ChangeApplierOptions {
  /** The registered table modules. The applier reads each table schema. */
  tables: Record<string, TableModule<string, any>>;
  /** The layer that provides the raw key-value store. */
  kvLayer: Layer.Layer<KvApi>;
  /** The event sink. The applier emits one event per stored row after commit. */
  emit?: (event: DbEvent) => Effect.Effect<void, DbError>;
}

/** Builds the quarantine row id. The id is stable for one scope and sequence. */
function quarantineId(scope: string, row: ChangeRow): string {
  return `${scope}:${row.seq}:${row.table}:${row.key}`;
}

/** Reports the failure text of one decode error. */
function detailOf(error: DbError): string {
  const cause = error.error;

  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Creates the change applier.
 * The applier writes every row and the cursor in one transaction.
 * The applier emits the row events after the commit.
 */
export function createChangeApplier(
  options: ChangeApplierOptions,
): ChangeApplier {
  const { tables, kvLayer, emit } = options;
  const schemas = new Map<string, TableSchema>(
    Object.values(tables).map((table) => [table.name, table.schema]),
  );

  const withKv = <A, E>(effect: Effect.Effect<A, E, KvApi>) =>
    Effect.provide(effect, kvLayer);

  const emitRows = (events: DbEvent[]) =>
    emit === undefined
      ? Effect.void
      : Effect.forEach(events, (event) => emit(event), { discard: true });

  const applyPage = (
    input: ApplyChangePageInput,
  ): Effect.Effect<ApplyChangePageResult, DbError> =>
    withKv(
      Effect.gen(function* () {
        const { scope, since, page } = input;

        if (since < page.oldestSeq) {
          return {
            status: "resync_required",
            reason: "resync_required",
            oldestSeq: page.oldestSeq,
          } as const;
        }

        if (page.next < since || (page.hasMore && page.next === since)) {
          return {
            status: "rejected",
            reason: "cursor_not_advanced",
          } as const;
        }

        const kv = yield* KvApi;
        const tx = yield* kv.beginTx();
        let committed = false;

        const work = Effect.gen(function* () {
          const events: DbEvent[] = [];
          const timestamp = new Date(page.serverTimeMs);
          let applied = 0;
          let deleted = 0;
          let quarantined = 0;

          const quarantine = (
            row: ChangeRow,
            reason: Quarantine["reason"],
            detail: string,
          ) =>
            Effect.gen(function* () {
              const id = quarantineId(scope, row);
              const doc: Quarantine = {
                id,
                scope,
                table_name: row.table,
                row_key: row.key,
                seq: row.seq,
                reason,
                detail,
                value: row.value,
                created_at: timestamp,
                modified_at: timestamp,
              };
              const encoded = Schema.encodeUnknownSync(QuarantineSchema)(doc);

              yield* tx.set(quarantineKeys.of(id), encoded);
              events.push({
                kind: "set",
                table: "quarantine",
                id,
                doc: encoded,
              });
              quarantined += 1;
            });

          for (const row of page.rows) {
            const schema = schemas.get(row.table);

            if (schema === undefined) {
              yield* quarantine(
                row,
                "unknown_table",
                `The table '${row.table}' is not registered.`,
              );
              continue;
            }

            if (row.deleted) {
              const removed = yield* tx.delete(
                tableKeys(row.table).of(row.key),
              );

              if (removed) {
                events.push({
                  kind: "delete",
                  table: row.table,
                  id: row.key,
                });
                deleted += 1;
              }
              continue;
            }

            const decoded = yield* decodeUnknownFx(schema, row.value).pipe(
              Effect.match({
                onFailure: (error) => ({ ok: false as const, error }),
                onSuccess: (value) => ({ ok: true as const, value }),
              }),
            );

            if (!decoded.ok) {
              yield* quarantine(row, "invalid_row", detailOf(decoded.error));
              continue;
            }

            const value = decoded.value as { id?: unknown } | null;

            if (
              value === null ||
              typeof value !== "object" ||
              value.id !== row.key
            ) {
              yield* quarantine(
                row,
                "invalid_row",
                "The row id does not match the row key.",
              );
              continue;
            }

            const encoded = Schema.encodeUnknownSync(schema)(value);

            yield* tx.set(tableKeys(row.table).of(row.key), encoded);
            events.push({
              kind: "set",
              table: row.table,
              id: row.key,
              doc: encoded,
            });
            applied += 1;
          }

          const state: SyncState = {
            id: scope,
            scope,
            cursor: page.next,
            updated_at: timestamp,
            created_at: timestamp,
            modified_at: timestamp,
          };
          const encodedState = Schema.encodeUnknownSync(SyncStateSchema)(state);

          yield* tx.set(syncStateKeys.of(scope), encodedState);
          events.push({
            kind: "set",
            table: "sync_state",
            id: scope,
            doc: encodedState,
          });

          yield* tx.commit();
          committed = true;

          yield* emitRows(events);

          return {
            status: "applied",
            cursor: page.next,
            applied,
            deleted,
            quarantined,
          } as const;
        });

        return yield* work.pipe(
          Effect.ensuring(
            Effect.suspend(() =>
              committed ? Effect.void : Effect.ignore(tx.rollback()),
            ),
          ),
        );
      }),
    );

  const state = (scope: string): Effect.Effect<SyncState | null, DbError> =>
    withKv(
      Effect.gen(function* () {
        const kv = yield* KvApi;
        const raw = yield* kv.get(syncStateKeys.of(scope));

        if (raw == null) {
          return null;
        }

        return yield* decodeUnknownFx(SyncStateSchema, raw);
      }),
    );

  return { applyPage, state };
}

/** Keeps the schema import used for the public state type. */
export type { SyncState };
