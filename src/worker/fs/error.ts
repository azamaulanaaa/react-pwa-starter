import { Schema } from "effect";

export class FsError extends Schema.TaggedError<FsError>()("app/worker/fs", {
  error: Schema.Unknown,
}) {}
