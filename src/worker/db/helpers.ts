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
  schema: Schema.Codec<A, I>,
  input: unknown,
): Effect.Effect<A, DbError> {
  return Schema.decodeEffect(schema)(input as I).pipe(
    Effect.mapError((error) => new DbError({ error })),
  );
}

export function decodeUnknownFx<A, I>(
  schema: Schema.Codec<A, I>,
  input: unknown,
): Effect.Effect<A, DbError> {
  return Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((error) => new DbError({ error })),
  );
}
