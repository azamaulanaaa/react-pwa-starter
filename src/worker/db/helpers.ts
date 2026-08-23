import { Effect, Schema } from "effect";

import { DbError } from "@/worker/db/error.ts";

export const fromPromise = <A>(
  op: () => Promise<A>,
): Effect.Effect<A, DbError> =>
  Effect.tryPromise({
    try: op,
    catch: (error) => new DbError({ error }),
  });

export function decodeFx<A, I>(
  schema: Schema.Schema<A, I, never>,
  input: unknown,
): Effect.Effect<A, DbError> {
  return Schema.decode(schema)(input as I).pipe(
    Effect.mapError((error) => new DbError({ error })),
  );
}

export function decodeUnknownFx<A, I>(
  schema: Schema.Schema<A, I, never>,
  input: unknown,
): Effect.Effect<A, DbError> {
  return Schema.decodeUnknown(schema)(input).pipe(
    Effect.mapError((error) => new DbError({ error })),
  );
}
