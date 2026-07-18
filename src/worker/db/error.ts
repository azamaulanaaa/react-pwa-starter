import { Data } from "effect";

export class DbError extends Data.TaggedError("app/worker/db")<{
  readonly error: unknown;
}> {}
