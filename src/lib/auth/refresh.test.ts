import { describe, expect, it, vi } from "vitest";

import {
  createMemorySessionStorage,
  createSessionCache,
} from "@/lib/auth/cache.ts";
import type { SessionChannel, SessionEvent } from "@/lib/auth/channel.ts";
import {
  createRefreshCoordinator,
  type RefreshLock,
} from "@/lib/auth/refresh.ts";
import type { Session } from "@/lib/auth/types.ts";

const NOW = 2_000_000_000_000;

function createSession(): Session {
  return {
    user: { id: "user-1" },
    expiresAt: NOW + 3_600_000,
  };
}

/** Creates a lock that runs one callback at a time. */
function createSerialLock(): RefreshLock {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    request<T>(_name: string, callback: () => Promise<T>): Promise<T> {
      const run = tail.then(callback, callback);
      tail = run.then(
        () => undefined,
        () => undefined,
      );

      return run;
    },
  };
}

/** Creates a channel hub that connects the fake tabs. */
function createChannelHub() {
  const listeners = new Set<(event: SessionEvent) => void>();

  return {
    create(): SessionChannel {
      return {
        publish(event) {
          for (const listener of listeners) {
            listener(event);
          }
        },
        subscribe(listener) {
          listeners.add(listener);

          return () => {
            listeners.delete(listener);
          };
        },
        close() {
          listeners.clear();
        },
      };
    },
  };
}

describe("refresh coordinator", () => {
  it("refreshes once when three tabs run at the same time", async () => {
    const cache = createSessionCache(createMemorySessionStorage());
    const lock = createSerialLock();
    const hub = createChannelHub();
    const load = vi.fn(async () => createSession());
    const tabs = [0, 1, 2].map(() =>
      createRefreshCoordinator({
        cache,
        lock,
        channel: hub.create(),
        now: () => NOW,
      }),
    );

    const sessions = await Promise.all(tabs.map((tab) => tab.refresh(load)));

    expect(load).toHaveBeenCalledTimes(1);
    expect(sessions.map((session) => session?.user.id)).toEqual([
      "user-1",
      "user-1",
      "user-1",
    ]);
    expect(cache.read()?.epoch).toBe(1);
  });

  it("sends the new session to the other tabs", async () => {
    const cache = createSessionCache(createMemorySessionStorage());
    const lock = createSerialLock();
    const hub = createChannelHub();
    const events: SessionEvent[] = [];
    hub.create().subscribe((event) => events.push(event));
    const coordinator = createRefreshCoordinator({
      cache,
      lock,
      channel: hub.create(),
      now: () => NOW,
    });

    await coordinator.refresh(async () => createSession());

    expect(events.at(-1)?.session?.user.id).toBe("user-1");
    expect(events.at(-1)?.epoch).toBe(1);
  });

  it("sends a null session when the refresh finds no session", async () => {
    const cache = createSessionCache(createMemorySessionStorage());
    const lock = createSerialLock();
    const hub = createChannelHub();
    const events: SessionEvent[] = [];
    hub.create().subscribe((event) => events.push(event));
    const coordinator = createRefreshCoordinator({
      cache,
      lock,
      channel: hub.create(),
      now: () => NOW,
    });

    await expect(coordinator.refresh(async () => null)).resolves.toBeNull();

    expect(events.at(-1)?.session).toBeNull();
  });
});
