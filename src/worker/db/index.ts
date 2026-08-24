import { createDatabase, createEventBus } from "@/worker/db/factory.ts";

import * as dbMainRaw from "@/worker/db/database/main.ts";
export type * from "@/worker/db/database/main.ts";
import { Effect } from "effect";
import { createDbFs, createPeerSync } from "@/worker/db-fs/index.ts";

const events = createEventBus();
const dbFs = createDbFs(dbMainRaw);
dbFs.attach(events);

const peers = createPeerSync();

const keyOf = (table: string, id: string) => `${table}:${id}`;

export const dbMain = createDatabase("main", dbMainRaw, {
  events,
  hydrate: dbFs.hydrate,
  setup: (ctx) => {
    ctx.onEvent((event) =>
      Effect.sync(() => {
        peers.publish(event);
      }),
    );

    peers.subscribe((event) => {
      void (async () => {
        const store = await ctx.open();
        const key = keyOf(event.table, event.id);

        if (event.kind === "set") {
          await store.set(key, event.doc);
        } else {
          await store.delete(key);
        }

        ctx.notify(event.table);
      })();
    });
  },
});
