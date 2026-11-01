import { systemTables } from "@/worker/db/system.ts";

/**
 * The application registers its table modules in this module.
 * Add a table module to the `tables` object to register it.
 * The starter registers the system tables only.
 */
export const tables = { ...systemTables };
