import { Schema } from "effect";

import { flattenTaggedError } from "@/lib/comlink/effect.ts";

const QueueErrorReasonSchema = Schema.Literals([
  "invalid_input",
  "unknown_kind",
  "queue_full",
  "timeout",
]);
export type QueueErrorReason = Schema.Schema.Type<
  typeof QueueErrorReasonSchema
>;

/**
 * The queue error that crosses the worker bridge.
 * The class tag is the worker error tag.
 * The message getter returns the text form of the cause beside the tag.
 */
export class QueueError extends Schema.TaggedError<QueueError>()(
  "app/worker/queue",
  {
    error: Schema.Unknown,
    reason: QueueErrorReasonSchema,
  },
) {
  /** The text form of the cause. The worker bridge sends this string. */
  get message(): string {
    return flattenTaggedError(this.error).message;
  }
}

export const queueError = (reason: QueueErrorReason, error: unknown) =>
  new QueueError({ error, reason });
