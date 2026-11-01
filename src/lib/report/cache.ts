import { clear, createStore, get, set, type UseStore } from "idb-keyval";

import type { FileRecord } from "@/lib/fs/index.ts";

/** Defines one cached report artifact. */
export interface CachedReport {
  /** The report job id. */
  reportId: string;
  /** The report month in `YYYY-MM` form. */
  month: string;
  /** The site id. */
  site?: string;
  /** The artifact file record. */
  file: FileRecord;
  /** The artifact content. */
  blob: Blob;
  /** The time that the cache stored the artifact in milliseconds. */
  savedAt: number;
}

/** Defines the lookup key for one cached report. */
export interface ReportCacheKey {
  /** The report month in `YYYY-MM` form. */
  month: string;
  /** The site id. */
  site?: string;
}

/**
 * Defines the report cache.
 * The cache stores the artifact Blob and the file metadata.
 * A test can replace the backing store.
 */
export interface ReportCache {
  /** Returns the cached artifact for one month and site. */
  get(key: ReportCacheKey): Promise<CachedReport | null>;
  /** Stores one artifact by report id and month. */
  set(value: CachedReport): Promise<void>;
  /** Removes every cached artifact. */
  clear(): Promise<void>;
}

/** Defines a key-value store for the report cache. */
export interface ReportCacheStore {
  /** Returns one value. The result is undefined when the key is absent. */
  get(key: string): Promise<unknown>;
  /** Stores one value. */
  set(key: string, value: unknown): Promise<void>;
  /** Removes every value. */
  clear(): Promise<void>;
}

/** Defines the options for the report cache. */
export interface ReportCacheOptions {
  /** The backing store. The default is the browser IndexedDB store. */
  store?: ReportCacheStore;
  /** Returns the current time in milliseconds. The default is `Date.now`. */
  now?: () => number;
}

const DEFAULT_STORE = createStore("report-cache", "artifacts");

/** Wraps the idb-keyval store in the report cache store. */
function idbStore(store: UseStore): ReportCacheStore {
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    clear: () => clear(store),
  };
}

/** Builds the store key for one artifact. */
function artifactKey(reportId: string, month: string): string {
  return `report:${month}:${reportId}`;
}

/** Builds the store key for the latest report of one month and site. */
function monthKey(month: string, site?: string): string {
  return `report-month:${month}:${site ?? ""}`;
}

/** Reports whether a value is a cached report. */
function isCachedReport(value: unknown): value is CachedReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "reportId" in value &&
    typeof value.reportId === "string" &&
    "month" in value &&
    typeof value.month === "string" &&
    "file" in value &&
    "blob" in value &&
    value.blob instanceof Blob
  );
}

/**
 * Creates the report cache.
 * The cache uses idb-keyval, not `localStorage`.
 * The cache keeps one artifact for each report id and month.
 */
export function createReportCache(
  options: ReportCacheOptions = {},
): ReportCache {
  const store = options.store ?? idbStore(DEFAULT_STORE);
  const now = options.now ?? Date.now;

  return {
    async get({ month, site }): Promise<CachedReport | null> {
      const reportId = await store.get(monthKey(month, site));

      if (typeof reportId !== "string" || reportId === "") return null;

      const value = await store.get(artifactKey(reportId, month));

      return isCachedReport(value) ? value : null;
    },

    async set(value): Promise<void> {
      const record: CachedReport = {
        ...value,
        savedAt: value.savedAt || now(),
      };

      await store.set(artifactKey(record.reportId, record.month), record);
      await store.set(monthKey(record.month, record.site), record.reportId);
    },

    /**
     * Removes every cached report artifact.
     * Issue 6 calls this function on logout and on a user change.
     * The caller waits for the result before the next user signs in.
     */
    async clear(): Promise<void> {
      await store.clear();
    },
  };
}
