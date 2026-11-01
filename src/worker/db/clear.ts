import { Effect } from "effect";
import { type BTreeStore, type BTreeTx, Direction } from "oxkv";

import type { DbError } from "@/worker/db/error.ts";
import { fromPromise } from "@/worker/db/helpers.ts";
import { type KvEntry, tableKeys } from "@/worker/db/kv.ts";
import type { DbPersistence } from "@/worker/db/persistence.ts";

/** Defines the result of one clear call. */
export interface ClearTablesResult {
  /** The table names that the call removed. */
  tables: string[];
  /** The number of rows that the call removed. */
  removed: number;
}

/** Defines the generic table clear operation. */
export interface TableClearer {
  /** Removes every row of the given tables. */
  clearTables(
    tables: readonly string[],
  ): Effect.Effect<ClearTablesResult, DbError>;
}

/** Defines the options for the table clear operation. */
export interface TableClearerOptions {
  /** Opens the raw key-value store. */
  open: () => Promise<BTreeStore>;
  /** The persistence sink. The clear removes the saved copy of each table. */
  persistence: Pick<DbPersistence, "clear">;
  /** Notifies the change bus after the commit. The clear calls it once per table. */
  notify?: (table: string) => void;
}

/**
 * Creates a generic table clear operation.
 * The caller gives the table names, so the worker names no domain table.
 * The operation removes the live rows and the saved copy of each table.
 * The operation notifies the change bus one time for each cleared table.
 * The outbox is a separate table and stays when the caller leaves it out.
 */
export function createTableClearer(options: TableClearerOptions): TableClearer {
  return {
    clearTables: (tables) =>
      Effect.gen(function* () {
        const names = [...new Set(tables)];
        const store = yield* fromPromise(options.open);
        const tx = yield* fromPromise(
          () => store.begin_tx() as Promise<BTreeTx>,
        );
        let committed = false;

        const work = Effect.gen(function* () {
          let removed = 0;

          for (const name of names) {
            const keys = tableKeys(name);
            const entries = yield* fromPromise(
              () =>
                store.gets(
                  null,
                  Direction.Next,
                  keys.lowerBound,
                  keys.upperBound,
                  null,
                ) as Promise<KvEntry[]>,
            );

            for (const entry of entries) {
              const deleted = yield* fromPromise(
                () => tx.delete(entry.key) as Promise<boolean>,
              );

              if (deleted) removed += 1;
            }
          }

          yield* fromPromise(() => tx.commit());
          committed = true;

          for (const name of names) options.notify?.(name);

          yield* Effect.forEach(
            names,
            (name) => options.persistence.clear(name),
            { discard: true },
          );

          return { tables: names, removed };
        });

        return yield* work.pipe(
          Effect.ensuring(
            Effect.suspend(() =>
              committed
                ? Effect.void
                : Effect.ignore(fromPromise(() => tx.rollback())),
            ),
          ),
        );
      }),
  };
}
