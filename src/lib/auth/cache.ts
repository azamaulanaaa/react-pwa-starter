import type { Session } from "@/lib/auth/types.ts";

/**
 * Holds the metadata of one cached session.
 * The cache does not hold the token. The cookie is the credential.
 */
export interface SessionCacheRecord {
  /** The identifier of the user for the cached session. */
  userId: string;
  /** The time when the session expires. The value uses Unix epoch milliseconds. */
  expiresAt: number;
  /** The time of the last successful network check. The value uses Unix epoch milliseconds. */
  lastVerifiedAt: number;
  /** The version of the record. A newer record has a higher value. */
  epoch: number;
}

/**
 * Defines a storage adapter for the session cache.
 * The adapter uses the Web Storage shape.
 */
export interface SessionCacheStorage {
  /** Returns the value for one key. The method returns null when the key is absent. */
  getItem(key: string): string | null;
  /** Stores one value for one key. */
  setItem(key: string, value: string): void;
  /** Removes one key. */
  removeItem(key: string): void;
}

/** Defines the session cache. */
export interface SessionCache {
  /** Returns the cached record. The method returns null for a missing or invalid record. */
  read(): SessionCacheRecord | null;
  /** Stores one record. */
  write(record: SessionCacheRecord): void;
  /** Removes the record. */
  clear(): void;
}

/** The default storage key for the session cache. */
export const SESSION_CACHE_KEY = "auth.session.cache";

/** The default offline grace window. The value is seven days in milliseconds. */
export const DEFAULT_OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** Defines the options for a cached session read. */
export interface CachedSessionOptions {
  /** The current time. The default is `Date.now`. */
  now?: number;
  /** The offline grace window in milliseconds. The default is seven days. */
  graceMs?: number;
}

/** Returns the browser local storage. The function returns null when the storage is not available. */
export function browserLocalStorage(): SessionCacheStorage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;

    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Creates an in-memory storage adapter. A test can use the adapter. */
export function createMemorySessionStorage(): SessionCacheStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

/** Reports whether a value has the fields of a session cache record. */
function isSessionCacheRecord(value: unknown): value is SessionCacheRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    typeof value.userId === "string" &&
    "expiresAt" in value &&
    typeof value.expiresAt === "number" &&
    "lastVerifiedAt" in value &&
    typeof value.lastVerifiedAt === "number" &&
    "epoch" in value &&
    typeof value.epoch === "number"
  );
}

/**
 * Creates the session cache.
 * The function uses local storage when the caller gives no storage.
 * The function uses memory storage when the browser storage is not available.
 */
export function createSessionCache(
  storage: SessionCacheStorage | null = browserLocalStorage(),
  key: string = SESSION_CACHE_KEY,
): SessionCache {
  const target = storage ?? createMemorySessionStorage();

  return {
    read() {
      let raw: string | null;

      try {
        raw = target.getItem(key);
      } catch {
        return null;
      }

      if (raw === null) return null;

      try {
        const value: unknown = JSON.parse(raw);

        if (!isSessionCacheRecord(value)) {
          target.removeItem(key);

          return null;
        }

        return value;
      } catch {
        target.removeItem(key);

        return null;
      }
    },

    write(record) {
      target.setItem(key, JSON.stringify(record));
    },

    clear() {
      target.removeItem(key);
    },
  };
}

/**
 * Reports whether the last network check is inside the offline grace window.
 * The function does not check the session expiry time.
 */
export function isWithinOfflineGrace(
  record: SessionCacheRecord,
  now: number = Date.now(),
  graceMs: number = DEFAULT_OFFLINE_GRACE_MS,
): boolean {
  return now - record.lastVerifiedAt <= graceMs;
}

/**
 * Returns a session from a cached record when the record is inside the grace window.
 * The session expiry is the later of the stored expiry and the grace deadline.
 * The session is offline-unverified after the token expiry.
 * The next network call must confirm the session.
 * A `401` on the flush must pause the outbox and ask for a login.
 * The function returns null when the record is outside the grace window.
 */
export function sessionFromCache(
  record: SessionCacheRecord,
  options: CachedSessionOptions = {},
): Session | null {
  const now = options.now ?? Date.now();
  const graceMs = options.graceMs ?? DEFAULT_OFFLINE_GRACE_MS;

  if (!isWithinOfflineGrace(record, now, graceMs)) return null;

  return {
    user: { id: record.userId },
    expiresAt: Math.max(record.expiresAt, record.lastVerifiedAt + graceMs),
  };
}

/**
 * Writes one verified session to the cache.
 * The function removes the previous record when the user id changes.
 * The function returns the new record.
 */
export function writeSessionCache(
  cache: SessionCache,
  session: Session,
  now: number = Date.now(),
): SessionCacheRecord {
  const previous = cache.read();
  const epoch = (previous?.epoch ?? 0) + 1;

  if (previous !== null && previous.userId !== session.user.id) {
    cache.clear();
  }

  const record: SessionCacheRecord = {
    userId: session.user.id,
    expiresAt: session.expiresAt,
    lastVerifiedAt: now,
    epoch,
  };

  cache.write(record);

  return record;
}

/**
 * Clears the session cache and returns the next epoch value.
 * The caller can send the epoch to the other tabs.
 */
export function clearSessionCache(cache: SessionCache): number {
  const epoch = (cache.read()?.epoch ?? 0) + 1;
  cache.clear();

  return epoch;
}
