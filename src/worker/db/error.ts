import { Schema } from "effect";

import { flattenTaggedError } from "@/lib/comlink/effect.ts";

/**
 * The database error that crosses the worker bridge.
 * The class tag is the worker error tag.
 * The message getter returns the text form of the cause beside the tag.
 */
export class DbError extends Schema.TaggedError<DbError>()("app/worker/db", {
  error: Schema.Unknown,
}) {
  /** The text form of the cause. The worker bridge sends this string. */
  get message(): string {
    return flattenTaggedError(this.error).message;
  }
}
