import { Schema } from "effect";

export class DbError extends Schema.TaggedError<DbError>()("app/worker/db", {
  error: Schema.Unknown,
}) {}
