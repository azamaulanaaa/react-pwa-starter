import { systemTables } from "@/worker/db/system.ts";
import { TableOutbox } from "@/worker/outbox/table.ts";

/**
 * The application registers its table modules in this module.
 * Add a table module to the `tables` object to register it.
 * The starter registers the system tables and the outbox table.
 */
export const tables = { ...systemTables, outbox: TableOutbox };
