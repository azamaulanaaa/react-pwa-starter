import { Effect, Schema } from "effect";

import { type QueueError, queueError } from "@/worker/queue/error.ts";

// One decoder, for input that arrives from the main thread as `unknown`. The
// DB module keeps its own typed decode for an input that is already checked.

export const decodeUnknownFx = Effect.fnUntraced(function* <A, I>(
  schema: Schema.Codec<A, I>,
  input: unknown,
): Effect.fn.Return<A, QueueError> {
  return yield* Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((error) => queueError("invalid_input", error)),
  );
});

export const nowIso = (): string => new Date().toISOString();
