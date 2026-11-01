import {
  browserLocalStorage,
  clearSessionCache,
  sessionFromCache,
  writeSessionCache,
  type SessionCache,
} from "@/lib/auth/cache.ts";
import type { SessionChannel } from "@/lib/auth/channel.ts";
import type { Session } from "@/lib/auth/types.ts";

/** The default name of the refresh lock. */
export const DEFAULT_REFRESH_LOCK = "auth.session.refresh";

/** The storage key prefix for the fallback lock. */
const STORAGE_LOCK_PREFIX = "auth.session.lock.";

/** The lifetime of the fallback lock. A crashed tab releases the lock after this time. */
const STORAGE_LOCK_TTL_MS = 60_000;

/** The retry delay for the fallback lock. */
const STORAGE_LOCK_RETRY_MS = 25;

/**
 * Defines the lock that serializes one refresh across tabs.
 * The browser can use `navigator.locks`. A test can give a fake lock.
 */
export interface RefreshLock {
  /** Runs one callback while the lock is held. */
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

/** Returns the browser lock manager. The function returns null when the browser has none. */
function browserLockManager(): LockManager | null {
  if (typeof navigator === "undefined") return null;

  const manager = (navigator as { locks?: LockManager }).locks;

  return manager ?? null;
}

/** Waits for one delay. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Reads one fallback lock value. */
function readStorageLock(
  storage: NonNullable<ReturnType<typeof browserLocalStorage>>,
  key: string,
): { owner: string; expiresAt: number } | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;

  try {
    const value: unknown = JSON.parse(raw);

    if (
      typeof value === "object" &&
      value !== null &&
      "owner" in value &&
      typeof value.owner === "string" &&
      "expiresAt" in value &&
      typeof value.expiresAt === "number"
    ) {
      return { owner: value.owner, expiresAt: value.expiresAt };
    }
  } catch {
    // A bad lock value is free.
  }

  return null;
}

/** Creates a lock that uses a storage mutex. */
function createStorageLock(): RefreshLock {
  return {
    async request<T>(name: string, callback: () => Promise<T>): Promise<T> {
      const storage = browserLocalStorage();

      if (storage === null) return callback();

      const key = `${STORAGE_LOCK_PREFIX}${name}`;
      const owner =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const deadline = Date.now() + STORAGE_LOCK_TTL_MS * 2;

      while (Date.now() < deadline) {
        const current = readStorageLock(storage, key);
        const now = Date.now();

        if (current === null || current.expiresAt <= now) {
          storage.setItem(
            key,
            JSON.stringify({ owner, expiresAt: now + STORAGE_LOCK_TTL_MS }),
          );

          if (readStorageLock(storage, key)?.owner === owner) {
            try {
              return await callback();
            } finally {
              if (readStorageLock(storage, key)?.owner === owner) {
                storage.removeItem(key);
              }
            }
          }
        }

        await delay(STORAGE_LOCK_RETRY_MS);
      }

      return callback();
    },
  };
}

/**
 * Creates the refresh lock.
 * The function uses `navigator.locks` when the browser provides it.
 * The function uses a storage mutex for the other browsers.
 */
export function createRefreshLock(): RefreshLock {
  const manager = browserLockManager();

  if (manager !== null) {
    return {
      request<T>(name: string, callback: () => Promise<T>): Promise<T> {
        return manager.request(name, callback);
      },
    };
  }

  return createStorageLock();
}

/** Defines the options for the refresh coordinator. */
export interface RefreshCoordinatorOptions {
  /** The session cache. The coordinator reads and writes the cache. */
  cache: SessionCache;
  /** The refresh lock. The default uses the browser lock manager or a storage mutex. */
  lock?: RefreshLock;
  /** The cross-tab channel. The coordinator sends each result to the other tabs. */
  channel?: SessionChannel;
  /** Returns the current time. The default is `Date.now`. */
  now?: () => number;
  /** The name of the refresh lock. */
  lockName?: string;
  /** The offline grace window in milliseconds. The default is seven days. */
  graceMs?: number;
}

/** Defines the single-flight refresh coordinator. */
export interface RefreshCoordinator {
  /**
   * Runs one refresh while no other tab refreshes.
   * The function reuses the cache when another tab refreshed first.
   */
  refresh(load: () => Promise<Session | null>): Promise<Session | null>;
}

/**
 * Creates the single-flight refresh coordinator.
 * The function runs one load call per refresh across all tabs.
 * The function sends the new session to the other tabs.
 */
export function createRefreshCoordinator(
  options: RefreshCoordinatorOptions,
): RefreshCoordinator {
  const {
    cache,
    lock = createRefreshLock(),
    channel,
    now = Date.now,
    lockName = DEFAULT_REFRESH_LOCK,
    graceMs,
  } = options;

  return {
    refresh(load) {
      const startedEpoch = cache.read()?.epoch ?? 0;

      return lock.request(lockName, async () => {
        const current = cache.read();

        if (current !== null && current.epoch > startedEpoch) {
          const cached = sessionFromCache(current, {
            now: now(),
            graceMs,
          });

          if (cached !== null) return cached;
        }

        const next = await load();

        if (next === null) {
          const epoch = clearSessionCache(cache);
          channel?.publish({ session: null, epoch });

          return null;
        }

        const record = writeSessionCache(cache, next, now());
        channel?.publish({ session: next, epoch: record.epoch });

        return next;
      });
    },
  };
}
