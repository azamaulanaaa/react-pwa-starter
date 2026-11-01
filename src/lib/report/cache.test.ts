import { describe, expect, it } from "vitest";

import type { ReportCacheStore } from "@/lib/report/cache.ts";
import { createReportCache } from "@/lib/report/cache.ts";

const FILE = {
  id: "file-1",
  size: 4,
  metadata: { name: "recap.csv", mimetype: "text/csv" },
};
const BLOB = new Blob(["data"], { type: "text/csv" });

/** Builds an in-memory cache store. */
function createMemoryStore(): ReportCacheStore {
  const values = new Map<string, unknown>();

  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value);
    },
    clear: async () => {
      values.clear();
    },
  };
}

describe("report cache", () => {
  it("stores the artifact by report id and month", async () => {
    const cache = createReportCache({
      store: createMemoryStore(),
      now: () => 42,
    });

    await cache.set({
      reportId: "job-1",
      month: "2026-10",
      file: FILE,
      blob: BLOB,
      savedAt: 0,
    });

    const cached = await cache.get({ month: "2026-10" });

    expect(cached?.reportId).toBe("job-1");
    expect(cached?.savedAt).toBe(42);
    expect(cached?.file).toEqual(FILE);
    await expect(cached?.blob.text()).resolves.toBe("data");
    expect(await cache.get({ month: "2026-11" })).toBeNull();
  });

  it("keeps the sites apart for the same month", async () => {
    const cache = createReportCache({ store: createMemoryStore() });

    await cache.set({
      reportId: "job-1",
      month: "2026-10",
      site: "north",
      file: FILE,
      blob: BLOB,
      savedAt: 1,
    });

    expect(await cache.get({ month: "2026-10", site: "north" })).not.toBeNull();
    expect(await cache.get({ month: "2026-10", site: "south" })).toBeNull();
  });

  it("clears the artifact cache on logout", async () => {
    const cache = createReportCache({ store: createMemoryStore() });

    await cache.set({
      reportId: "job-1",
      month: "2026-10",
      file: FILE,
      blob: BLOB,
      savedAt: 1,
    });
    await cache.clear();

    expect(await cache.get({ month: "2026-10" })).toBeNull();
  });
});
