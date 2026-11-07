import { Effect, Exit, Scope } from "effect";

/**
 * Creates a new closeable scope.
 * The caller owns the scope and closes it with `Scope.close`.
 */
export const createWorkerScope = (): Scope.Closeable =>
  Effect.runSync(Scope.make());

/**
 * The one scope that owns every long-lived worker fiber.
 * The queue loop and the outbox flusher run under this scope.
 */
export const workerScope: Scope.Closeable = createWorkerScope();

/**
 * Stops the worker side fibers.
 * The function closes the singleton scope and waits for the finalizers.
 * The UI does not call this function across the Comlink port.
 */
export const stopWorker = (): Promise<void> =>
  Effect.runPromise(Scope.close(workerScope, Exit.void));
