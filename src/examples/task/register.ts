import { TableTask } from "@/examples/task/table.ts";

/**
 * Defines the task table map for the example.
 * An application adds this map to the `tables` object in
 * `src/worker/db/database/main.ts`.
 */
export const taskTables = { task: TableTask };
