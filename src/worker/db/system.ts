import { Schema, Struct } from "effect";

import { createTableModule } from "@/worker/db/factory.ts";
import { tableKeys } from "@/worker/db/kv.ts";
import { BaseSchema } from "@/worker/db/schema.ts";

// A non-negative integer. v4 has no `Schema.NonNegativeInt`.
const NonNegativeInt = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);

/**
 * Defines the system state for one change scope.
 * The state holds the scope, the cursor, and the update time.
 * The row id is the scope name.
 */
export const SyncStateSchema = BaseSchema.mapFields(
  Struct.assign(
    Schema.Struct({
      scope: Schema.NonEmptyString,
      cursor: NonNegativeInt,
      updated_at: Schema.DateFromString,
    }).fields,
  ),
);
export type SyncState = Schema.Schema.Type<typeof SyncStateSchema>;

/**
 * Defines the quarantine reasons for one rejected change row.
 * `unknown_table` means the table is not registered.
 * `invalid_row` means the table schema rejected the row.
 */
export const QuarantineReasonSchema = Schema.Literals([
  "unknown_table",
  "invalid_row",
]);
export type QuarantineReason = Schema.Schema.Type<
  typeof QuarantineReasonSchema
>;

/**
 * Defines one change row that the apply step rejected.
 * The row id is stable for one scope and one server sequence.
 */
export const QuarantineSchema = BaseSchema.mapFields(
  Struct.assign(
    Schema.Struct({
      scope: Schema.NonEmptyString,
      table_name: Schema.NonEmptyString,
      row_key: Schema.NonEmptyString,
      seq: NonNegativeInt,
      reason: QuarantineReasonSchema,
      detail: Schema.NullOr(Schema.String),
      value: Schema.Unknown,
    }).fields,
  ),
);
export type Quarantine = Schema.Schema.Type<typeof QuarantineSchema>;

/** Defines the system table for the per-scope cursor. */
export const SyncStateTable = createTableModule({
  name: "sync_state",
  schema: SyncStateSchema,
});

/** Defines the system table for the rejected change rows. */
export const QuarantineTable = createTableModule({
  name: "quarantine",
  schema: QuarantineSchema,
});

/** Holds the system table map. The worker registers these tables. */
export const systemTables = {
  sync_state: SyncStateTable,
  quarantine: QuarantineTable,
};

/** Holds the key helpers for the sync state table. */
export const syncStateKeys = tableKeys("sync_state");

/** Holds the key helpers for the quarantine table. */
export const quarantineKeys = tableKeys("quarantine");
