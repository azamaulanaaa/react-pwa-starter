import { changes, clearTables, dbMain } from "@/worker/db/index.ts";
import * as fs from "@/worker/fs/index.ts";
import { outbox } from "@/worker/outbox/index.ts";
import { queue } from "@/worker/queue/index.ts";

/**
 * The worker API that the Comlink port exposes.
 * The shape is `{ changes, db, fs, outbox, queue }`.
 */
export const workerApi = {
  changes,
  db: { ...dbMain, clearTables },
  fs,
  outbox,
  queue,
};

export { stopWorker } from "@/worker/supervisor.ts";
