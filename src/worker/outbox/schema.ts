import { Schema, Struct } from "effect";

import type { OutboxOp } from "@/lib/outbox/types.ts";
import { BaseSchema } from "@/worker/db/schema.ts";

export const OutboxMethodSchema = Schema.Literals([
  "PUT",
  "POST",
  "PATCH",
  "DELETE",
]);

export const OutboxStateSchema = Schema.Literals([
  "pending",
  "sending",
  "failed",
  "conflict",
  "done",
]);

export const OutboxErrorInfoSchema = Schema.Struct({
  code: Schema.NonEmptyString,
  message: Schema.String,
});

export const OutboxLocalChangeSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literals(["set"]),
    table: Schema.NonEmptyString,
    id: Schema.NonEmptyString,
    value: Schema.Unknown,
  }),
  Schema.Struct({
    kind: Schema.Literals(["delete"]),
    table: Schema.NonEmptyString,
    id: Schema.NonEmptyString,
  }),
]);

export const OutboxEnqueueInputSchema = Schema.Struct({
  kind: Schema.NonEmptyString,
  method: OutboxMethodSchema,
  path: Schema.NonEmptyString,
  body: Schema.optional(Schema.Unknown),
  createdAt: Schema.optional(Schema.Number),
  local: Schema.optional(Schema.Array(OutboxLocalChangeSchema)),
});

// The base schema supplies `id`, `created_at`, and `modified_at`.
const OutboxFieldsSchema = Schema.Struct({
  kind: Schema.NonEmptyString,
  method: OutboxMethodSchema,
  path: Schema.NonEmptyString,
  body: Schema.Unknown,
  createdAt: Schema.Number,
  attempts: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
  ),
  nextAttemptAt: Schema.Number,
  state: OutboxStateSchema,
  lastError: Schema.optional(OutboxErrorInfoSchema),
});

export const OutboxRecordSchema = BaseSchema.mapFields(
  Struct.assign(OutboxFieldsSchema.fields),
);

export type OutboxRecord = Schema.Schema.Type<typeof OutboxRecordSchema>;
export type OutboxRecordEncoded = Schema.toEncoded<typeof OutboxRecordSchema>;

/** Returns the public operation for one stored record. */
export function toOutboxOp(record: OutboxRecord): OutboxOp {
  return {
    id: record.id,
    kind: record.kind,
    method: record.method,
    path: record.path,
    body: record.body,
    createdAt: record.createdAt,
    attempts: record.attempts,
    nextAttemptAt: record.nextAttemptAt,
    state: record.state,
    ...(record.lastError === undefined ? {} : { lastError: record.lastError }),
  };
}
