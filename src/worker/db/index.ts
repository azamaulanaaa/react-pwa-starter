import { createDatabase } from "@/worker/db/factory.ts";
export type { StreamParam } from "@/worker/db/factory.ts";

import * as dbMainRaw from "@/worker/db/database/main.ts";
export type * from "@/worker/db/database/main.ts";
export const dbMain = createDatabase("main", dbMainRaw);
