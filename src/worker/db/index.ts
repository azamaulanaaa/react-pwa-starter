import { createDatabase, createEventBus } from "@/worker/db/factory.ts";

import * as dbMainRaw from "@/worker/db/database/main.ts";
export type * from "@/worker/db/database/main.ts";
import { createDbFs } from "@/worker/db-fs/index.ts";

const events = createEventBus();
const dbFs = createDbFs(dbMainRaw);
dbFs.attach(events);

export const dbMain = createDatabase("main", dbMainRaw, {
  events,
  hydrate: dbFs.hydrate,
});
