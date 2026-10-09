import { Effect, Schema } from "effect";

import { QueueError } from "@/worker/queue/error.ts";

export const JobIdSchema = Schema.NonEmptyString;
export type JobId = Schema.Schema.Type<typeof JobIdSchema>;

export const JobKindSchema = Schema.NonEmptyString;
export type JobKind = Schema.Schema.Type<typeof JobKindSchema>;

export const JobStateSchema = Schema.Literals([
  "queued",
  "running",
  "paused",
  "succeeded",
  "failed",
  "canceled",
]);
export type JobState = Schema.Schema.Type<typeof JobStateSchema>;

export const JobSchema = Schema.Struct({
  id: JobIdSchema,
  kind: JobKindSchema,
  payload: Schema.Unknown,
  state: JobStateSchema,
  progress: Schema.Number.check(
    Schema.isFinite(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(1),
  ),
  attempt: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
  ),
  created_at: Schema.NonEmptyString,
  updated_at: Schema.NonEmptyString,
  result: Schema.NullOr(Schema.Unknown),
  error: Schema.NullOr(Schema.String),
});
export type Job = Schema.Schema.Type<typeof JobSchema>;

export const EnqueueInputSchema = Schema.Struct({
  kind: JobKindSchema,
  payload: Schema.optional(Schema.Unknown),
});
export type EnqueueInput = Schema.Schema.Type<typeof EnqueueInputSchema>;

export const ListFilterSchema = Schema.Struct({
  states: Schema.optional(Schema.Array(JobStateSchema)),
});
export type ListFilter = Schema.Schema.Type<typeof ListFilterSchema>;

export const WaitOptionsSchema = Schema.Struct({
  timeout_ms: Schema.optional(
    Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  ),
});
export type WaitOptions = Schema.Schema.Type<typeof WaitOptionsSchema>;

export const QueueConfigSchema = Schema.Struct({
  concurrency: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
  ),
  capacity: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
  ),
});
export type QueueConfig = Schema.Schema.Type<typeof QueueConfigSchema>;

// The single place the defaults live, so a test pins them without a runtime.
export const resolveConfig = (input?: Partial<QueueConfig>): QueueConfig => ({
  concurrency: input?.concurrency ?? 2,
  capacity: input?.capacity ?? 64,
});

export type JobContext = {
  readonly id: JobId;
  readonly kind: JobKind;
  readonly payload: unknown;
  readonly attempt: number;
  readonly signal: AbortSignal;
  // The channel is `QueueError`, not `never`, because the persist seam behind
  // a write can fail. It matches the handler's own error channel.
  readonly progress: (fraction: number) => Effect.Effect<boolean, QueueError>;
};

// A handler runs with no context requirement. A handler that needs a service
// closes the requirement at registration with `Effect.provide`, so the
// runtime never grows an `R`.
export type JobHandler = (
  ctx: JobContext,
) => Effect.Effect<unknown, QueueError, never>;
