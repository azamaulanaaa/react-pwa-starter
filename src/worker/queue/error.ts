import { Schema } from "effect";

const QueueErrorReasonSchema = Schema.Literals([
  "invalid_input",
  "unknown_kind",
  "queue_full",
  "timeout",
]);
export type QueueErrorReason = Schema.Schema.Type<
  typeof QueueErrorReasonSchema
>;

export class QueueError extends Schema.TaggedError<QueueError>()(
  "app/worker/queue",
  {
    error: Schema.Unknown,
    reason: QueueErrorReasonSchema,
  },
) {}

export const queueError = (reason: QueueErrorReason, error: unknown) =>
  new QueueError({ error, reason });
