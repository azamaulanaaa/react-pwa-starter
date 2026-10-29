import { Effect, Schema } from "effect";

import { DbError } from "@/worker/db/error.ts";

export const fromPromise = <A>(
  op: () => Promise<A>,
): Effect.Effect<A, DbError> =>
  Effect.tryPromise({
    try: op,
    catch: (error) => new DbError({ error }),
  });

export const decodeFx = Effect.fnUntraced(function* <A, I>(
  schema: Schema.Codec<A, I>,
  input: unknown,
): Effect.fn.Return<A, DbError> {
  return yield* Schema.decodeEffect(schema)(input as I).pipe(
    Effect.mapError((error) => new DbError({ error })),
  );
});

export const decodeUnknownFx = Effect.fnUntraced(function* <A, I>(
  schema: Schema.Codec<A, I>,
  input: unknown,
): Effect.fn.Return<A, DbError> {
  return yield* Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((error) => new DbError({ error })),
  );
});
