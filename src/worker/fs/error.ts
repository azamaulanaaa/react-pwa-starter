import { Data } from "effect";

export class FsError extends Data.TaggedError("app/worker/fs")<{
  readonly error: unknown;
}> {}
