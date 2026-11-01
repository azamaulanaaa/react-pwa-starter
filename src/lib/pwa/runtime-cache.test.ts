import { describe, expect, it, vi } from "vitest";

import {
  clearRuntimeCaches,
  PRECACHE_PREFIX,
} from "@/lib/pwa/runtime-cache.ts";

describe("clearRuntimeCaches", () => {
  it("removes the runtime caches and keeps the precache", async () => {
    const deleteCache = vi.fn(async () => true);
    const storage = {
      keys: vi.fn(async () => [
        `${PRECACHE_PREFIX}-v2-scope`,
        "workbox-runtime-scope",
        "app-data",
      ]),
      delete: deleteCache,
    };

    const removed = await clearRuntimeCaches(storage);

    expect(removed).toEqual(["workbox-runtime-scope", "app-data"]);
    expect(deleteCache).toHaveBeenCalledWith("workbox-runtime-scope");
    expect(deleteCache).toHaveBeenCalledWith("app-data");
    expect(deleteCache).not.toHaveBeenCalledWith(`${PRECACHE_PREFIX}-v2-scope`);
  });

  it("returns an empty list when the cache storage is absent", async () => {
    await expect(clearRuntimeCaches(null)).resolves.toEqual([]);
  });
});
