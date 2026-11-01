import { createDatabase, createEventBus } from "@/worker/db/factory.ts";

import { tables } from "@/worker/db/database/main.ts";
export type * from "@/worker/db/database/main.ts";
import { Effect } from "effect";
import { emitLog } from "@/telemetry/api.ts";
import type { DbEvent } from "@/worker/db/factory.ts";
import { fromPromise } from "@/worker/db/helpers.ts";
import { createDbFs, createPeerSync } from "@/worker/db/persistence.ts";
import { tableKeys } from "@/worker/db/kv.ts";
import { type ChangeApplier, createChangeApplier } from "@/worker/db/apply.ts";

const events = createEventBus();
const dbFs = createDbFs(tables);
dbFs.attach(events);

const peers = createPeerSync();

let applier: ChangeApplier | null = null;

export const dbMain = createDatabase("main", tables, {
  events,
  hydrate: dbFs.hydrate,
  setup: (ctx) => {
    applier = createChangeApplier({
      tables,
      kvLayer: ctx.kvLayer,
      emit: ctx.emit,
    });

    ctx.onEvent((event) =>
      Effect.sync(() => {
        peers.publish(event);
      }),
    );

    // The function applies a peer event to the raw store.
    // A raw store write does not notify watchers, so the function notifies
    // them itself.
    // A failure must not escape as an unhandled rejection. The function
    // reports the failure and keeps the worker alive.
    const applyPeerEvent = (event: DbEvent) =>
      Effect.gen(function* () {
        const store = yield* fromPromise(() => ctx.open());
        const key = tableKeys(event.table).of(event.id);

        if (event.kind === "set") {
          yield* fromPromise(() => store.set(key, event.doc));
        } else {
          yield* fromPromise(() => store.delete(key) as Promise<boolean>);
        }

        ctx.notify(event.table);
      });

    peers.subscribe((event) => {
      const key = tableKeys(event.table).of(event.id);

      Effect.runPromise(
        applyPeerEvent(event).pipe(
          Effect.catch((error) =>
            Effect.sync(() => {
              const cause = error.error;
              emitLog("ERROR", `Failed to apply peer ${key}`, {
                "error.source": "db.peer_sync",
                "error.kind": event.kind,
                "error.stack":
                  cause instanceof Error ? cause.stack : String(cause),
              });
            }),
          ),
        ),
      );
    });
  },
});

const requireApplier = (): ChangeApplier => {
  if (applier === null) {
    throw new Error("The change applier is not ready.");
  }

  return applier;
};

/**
 * The change apply API for the worker entry.
 * The entry exposes this object beside the database, the file store, and the queue.
 */
export const changes: ChangeApplier = {
  applyPage: (input) => requireApplier().applyPage(input),
  state: (scope) => requireApplier().state(scope),
};
