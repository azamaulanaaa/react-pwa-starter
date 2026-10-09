import { Effect, Queue, Stream } from "effect";

import type { QueueError } from "@/worker/queue/error.ts";
import type { Job, ListFilter } from "@/worker/queue/schema.ts";
import type { JobStore } from "@/worker/queue/store.ts";

export type WatchSubscription = {
  readonly filter: ListFilter | undefined;
  readonly snapshot: Effect.Effect<Job[], QueueError>;
  readonly queue: Queue.Queue<Job[]>;
  readonly release: () => void;
};

/**
 * The reactive fan-out. Each subscriber owns a sliding queue of one, so a slow
 * reader keeps the newest list and drops the intermediate one instead of
 * missing updates the way a `PubSub` publish would.
 */
export type WatchBus = {
  readonly subscribe: (
    filter?: ListFilter,
  ) => Effect.Effect<WatchSubscription, QueueError>;
  readonly publish: () => Effect.Effect<void, QueueError>;
};

export const createWatchBus = (store: JobStore): WatchBus => {
  const subscriptions = new Set<WatchSubscription>();

  return {
    // The subscriber registers before it reads the snapshot, so a publish in
    // between is queued and delivered after the snapshot. There is no gap.
    subscribe: (filter) =>
      Effect.gen(function* () {
        const queue = yield* Queue.sliding<Job[]>(1);
        const subscription: WatchSubscription = {
          filter,
          snapshot: store.list(filter),
          queue,
          release: () => {
            subscriptions.delete(subscription);
          },
        };
        subscriptions.add(subscription);
        return subscription;
      }),

    publish: () =>
      Effect.forEach([...subscriptions], (subscription) =>
        Effect.flatMap(
          store.list(subscription.filter),
          (jobs) => Queue.offer(subscription.queue, jobs),
        ), { discard: true }),
  };
};

export const watchStream = (
  bus: WatchBus,
  filter?: ListFilter,
): Stream.Stream<Job[], QueueError, never> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const subscription = yield* Effect.acquireRelease(
        bus.subscribe(filter),
        (sub) => Effect.sync(sub.release),
      );

      return Stream.concat(
        Stream.make(yield* subscription.snapshot),
        Stream.fromQueue(subscription.queue),
      );
    }),
  );
