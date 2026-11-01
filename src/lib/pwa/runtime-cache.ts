/** The prefix of the Workbox precache that holds the app shell. */
export const PRECACHE_PREFIX = "workbox-precache";

/** Defines the cache storage methods that the clear operation uses. */
export interface RuntimeCacheStorage {
  /** Returns every cache name. */
  keys(): Promise<string[]>;
  /** Removes one cache by name. */
  delete(name: string): Promise<boolean>;
}

/**
 * Removes the service worker runtime caches.
 * The function keeps the precache that holds the app shell.
 * The function returns the names that it removed.
 */
export async function clearRuntimeCaches(
  storage: RuntimeCacheStorage | null = globalThis.caches ?? null,
): Promise<string[]> {
  if (storage === null) return [];

  const names = await storage.keys();
  const runtime = names.filter((name) => !name.startsWith(PRECACHE_PREFIX));

  await Promise.all(runtime.map((name) => storage.delete(name)));

  return runtime;
}
