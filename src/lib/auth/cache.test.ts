import { describe, expect, it, vi } from "vitest";

import {
  createMemorySessionStorage,
  createSessionCache,
  DEFAULT_OFFLINE_GRACE_MS,
  SESSION_CACHE_KEY,
  sessionFromCache,
  writeSessionCache,
  clearSessionCache,
  type SessionCacheRecord,
} from "@/lib/auth/cache.ts";
import type { Session } from "@/lib/auth/types.ts";

const RECORD: SessionCacheRecord = {
  userId: "user-1",
  expiresAt: 2_000_000,
  lastVerifiedAt: 1_900_000,
  epoch: 1,
};

describe("session cache", () => {
  it("reads a record that it wrote", () => {
    const cache = createSessionCache(createMemorySessionStorage());

    cache.write(RECORD);

    expect(cache.read()).toEqual(RECORD);
  });

  it("returns null for invalid JSON", () => {
    const storage = createMemorySessionStorage();
    storage.setItem(SESSION_CACHE_KEY, "{");

    expect(createSessionCache(storage).read()).toBeNull();
  });

  it("removes an invalid record from the storage", () => {
    const storage = createMemorySessionStorage();
    const cache = createSessionCache(storage);
    storage.setItem(SESSION_CACHE_KEY, JSON.stringify({ userId: 3 }));

    expect(cache.read()).toBeNull();
    expect(storage.getItem(SESSION_CACHE_KEY)).toBeNull();
  });

  it("returns the cached session inside the grace window", () => {
    const session = sessionFromCache(RECORD, {
      now: RECORD.lastVerifiedAt + 1_000,
      graceMs: DEFAULT_OFFLINE_GRACE_MS,
    });

    expect(session?.user.id).toBe("user-1");
  });

  it("extends the expiry to the end of the grace window", () => {
    const session = sessionFromCache(RECORD, {
      now: RECORD.lastVerifiedAt + 1_000,
      graceMs: DEFAULT_OFFLINE_GRACE_MS,
    });

    expect(session?.expiresAt).toBe(
      RECORD.lastVerifiedAt + DEFAULT_OFFLINE_GRACE_MS,
    );
  });

  it("returns null after the grace window", () => {
    const session = sessionFromCache(RECORD, {
      now: RECORD.lastVerifiedAt + DEFAULT_OFFLINE_GRACE_MS + 1,
      graceMs: DEFAULT_OFFLINE_GRACE_MS,
    });

    expect(session).toBeNull();
  });

  it("clears the previous user when the user id changes", () => {
    const storage = createMemorySessionStorage();
    const remove = vi.spyOn(storage, "removeItem");
    const cache = createSessionCache(storage);
    cache.write(RECORD);
    const session: Session = {
      user: { id: "user-2" },
      expiresAt: 3_000_000,
    };

    const record = writeSessionCache(cache, session, 2_500_000);

    expect(remove).toHaveBeenCalledWith(SESSION_CACHE_KEY);
    expect(record.userId).toBe("user-2");
    expect(record.epoch).toBe(2);
    expect(cache.read()).toEqual(record);
  });

  it("increases the epoch when a record changes", () => {
    const cache = createSessionCache(createMemorySessionStorage());
    cache.write(RECORD);

    expect(clearSessionCache(cache)).toBe(2);
    expect(cache.read()).toBeNull();
  });
});
