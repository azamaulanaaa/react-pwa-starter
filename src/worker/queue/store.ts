import { Effect, Ref } from "effect";

import type { QueueError } from "@/worker/queue/error.ts";
import { nowIso } from "@/worker/queue/helpers.ts";
import type { Job, JobId, ListFilter } from "@/worker/queue/schema.ts";

// Terminal states are final. Nothing reopens them.
export const isTerminal = (state: Job["state"]): boolean =>
  state === "succeeded" || state === "failed" || state === "canceled";

/**
 * The record store. It is the single source of truth and the persist seam, so
 * a future persistence layer replaces this module and nothing else.
 */
export type JobStore = {
  /** The persist seam. v1 writes nothing. */
  readonly persist: (job: Job) => Effect.Effect<void, QueueError>;
  /** The load seam. v1 has nothing to load. */
  readonly load: () => Effect.Effect<Job[], QueueError>;
  readonly get: (id: JobId) => Effect.Effect<Job | null>;
  readonly list: (filter?: ListFilter) => Effect.Effect<Job[]>;
  /** The oldest queued record, or null when nothing is queued. */
  readonly firstQueued: () => Effect.Effect<Job | null>;
  /** The number of non-terminal records. This is the admission count. */
  readonly liveCount: () => Effect.Effect<number>;
  /** Insert or replace. A replace keeps the record's position. */
  readonly put: (job: Job) => Effect.Effect<void>;
  /** Delete then insert, so the record lands at the end of the order. */
  readonly requeue: (job: Job) => Effect.Effect<void>;
  /**
   * One atomic read-modify-write. The patch returns null to refuse, which
   * leaves the record untouched. `requeue` moves the record to the end.
   */
  readonly update: (
    id: JobId,
    patch: (job: Job) => Job | null,
    options?: { readonly requeue?: boolean },
  ) => Effect.Effect<Job | null>;
  readonly touch: (id: JobId) => Effect.Effect<void>;
  readonly remove: (id: JobId) => Effect.Effect<void>;
};

export const createStore = (): Effect.Effect<JobStore> =>
  // A plain `Map`, copy-on-write on every change. The insertion order is the
  // FIFO order, and v4's `HashMap` is a trie that does not preserve it.
  Ref.make(new Map<JobId, Job>()).pipe(
    Effect.map((records) => {
      const write = (
        update: (current: Map<JobId, Job>) => Map<JobId, Job>,
      ): Effect.Effect<void> => Ref.update(records, update);

      // `Map.set` on an existing key keeps the key's position, so this is the
      // replace path. The map is copied because other fibers have already read
      // the previous one. A delete before the insert moves the record to the
      // end of the order.
      const place = (
        current: Map<JobId, Job>,
        job: Job,
        requeue: boolean,
      ): Map<JobId, Job> => {
        const next = new Map(current);
        if (requeue) next.delete(job.id);
        next.set(job.id, job);
        return next;
      };

      const set = (current: Map<JobId, Job>, job: Job): Map<JobId, Job> =>
        place(current, job, false);

      const persist = (_job: Job): Effect.Effect<void, QueueError> =>
        Effect.void;

      /**
       * One atomic read-modify-write. A read followed by a separate write
       * lets two callers interleave. The slower caller then restores its stale
       * snapshot over the state the faster caller already wrote. No operation
       * awaits between the read and the write today, so no other caller can
       * run in between. The persist seam adds that await.
       */
      const update = (
        id: JobId,
        patch: (job: Job) => Job | null,
        options?: { readonly requeue?: boolean },
      ): Effect.Effect<Job | null> =>
        Ref.modify(records, (current) => {
          const job = current.get(id);
          if (job === undefined) return [null, current] as const;
          const next = patch(job);
          if (next === null) return [null, current] as const;
          return [
            next,
            place(current, next, options?.requeue === true),
          ] as const;
        });

      return {
        persist,
        load: (): Effect.Effect<Job[], QueueError> => Effect.succeed([]),

        get: (id) =>
          Ref.get(records).pipe(
            Effect.map((current) => current.get(id) ?? null),
          ),

        list: (filter) =>
          Ref.get(records).pipe(
            Effect.map((current) => {
              const jobs = [...current.values()];
              const states = filter?.states;
              return states === undefined
                ? jobs
                : jobs.filter((job) => states.includes(job.state));
            }),
          ),

        firstQueued: () =>
          Ref.get(records).pipe(
            Effect.map((current) => {
              for (const job of current.values()) {
                if (job.state === "queued") return job;
              }
              return null;
            }),
          ),

        liveCount: () =>
          Ref.get(records).pipe(
            Effect.map(
              (current) =>
                [...current.values()].filter((job) => !isTerminal(job.state))
                  .length,
            ),
          ),

        put: (job) => write((current) => set(current, job)),

        requeue: (job) => write((current) => place(current, job, true)),

        update,

        // The timestamp is applied inside the same atomic write as the read,
        // so a touch cannot restore a stale snapshot over a concurrent
        // state change.
        touch: (id) =>
          update(id, (job) => ({ ...job, updated_at: nowIso() })).pipe(
            Effect.asVoid,
          ),

        remove: (id) =>
          write((current) => {
            if (!current.has(id)) return current;
            const next = new Map(current);
            next.delete(id);
            return next;
          }),
      };
    }),
  );
