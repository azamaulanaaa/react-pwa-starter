import { Schema } from "effect";

const OutboxErrorReasonSchema = Schema.Literals([
  "invalid_input",
  "unknown_kind",
  "storage",
]);
export type OutboxErrorReason = Schema.Schema.Type<
  typeof OutboxErrorReasonSchema
>;

export class OutboxError extends Schema.TaggedError<OutboxError>()(
  "app/worker/outbox",
  {
    error: Schema.Unknown,
    reason: OutboxErrorReasonSchema,
  },
) {}

export const outboxError = (reason: OutboxErrorReason, error: unknown) =>
  new OutboxError({ error, reason });
