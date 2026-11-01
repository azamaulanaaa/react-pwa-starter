import { useMemo } from "react";

import { useWorker } from "@/components/context/worker.tsx";
import { clearSessionCache, createSessionCache } from "@/lib/auth/cache.ts";
import {
  DEFAULT_RESET_TABLES,
  type SessionResetInput,
} from "@/lib/auth/reset.ts";
import type { OutboxCounts } from "@/lib/outbox/types.ts";
import { clearRuntimeCaches as clearBrowserRuntimeCaches } from "@/lib/pwa/runtime-cache.ts";
import { createReportCache } from "@/lib/report/cache.ts";

/** Defines the reset steps that the caller can replace. */
export interface ResetDependencyOverrides {
  /** The tables to clear. The default holds the system tables. */
  tables?: readonly string[];
  /** Reads the outbox counts. */
  readOutbox?: () => Promise<Pick<OutboxCounts, "pending" | "sending">>;
  /** Removes every row of the given tables. */
  clearTables?: (tables: readonly string[]) => Promise<unknown>;
  /** Removes every cached report artifact. */
  clearReportCache?: () => Promise<void>;
  /** Removes the service worker runtime caches. */
  clearRuntimeCaches?: () => Promise<void>;
  /** Removes the session cache. */
  clearSessionCache?: () => void;
}

/** Defines the reset input without the logout step. */
export type ResetDependencies = Omit<SessionResetInput, "logout">;

/**
 * Returns the reset steps for the worker, the report cache, and the browser.
 * A caller can replace one step, so a test needs no worker or browser cache.
 */
export function useResetDependencies(
  overrides: ResetDependencyOverrides = {},
): ResetDependencies {
  const worker = useWorker();
  const {
    tables,
    readOutbox,
    clearTables,
    clearReportCache,
    clearRuntimeCaches,
    clearSessionCache: clearSessionCacheStep,
  } = overrides;

  return useMemo(
    () => ({
      tables: tables ?? DEFAULT_RESET_TABLES,
      readOutbox: readOutbox ?? (() => worker.outbox.status()),
      clearTables: clearTables ?? ((names) => worker.db.clearTables(names)),
      clearReportCache: clearReportCache ?? (() => createReportCache().clear()),
      clearRuntimeCaches:
        clearRuntimeCaches ??
        (async () => {
          await clearBrowserRuntimeCaches();
        }),
      clearSessionCache:
        clearSessionCacheStep ??
        (() => {
          clearSessionCache(createSessionCache());
        }),
    }),
    [
      clearReportCache,
      clearRuntimeCaches,
      clearSessionCacheStep,
      clearTables,
      readOutbox,
      tables,
      worker,
    ],
  );
}
