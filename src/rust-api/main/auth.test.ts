import { describe, expect, it, vi } from "vitest";

import {
  createMemorySessionStorage,
  createSessionCache,
  DEFAULT_OFFLINE_GRACE_MS,
  RETURN_TO_KEY,
  SESSION_CACHE_KEY,
  SessionError,
} from "@/lib/auth/index.ts";
import type { SessionChannel } from "@/lib/auth/index.ts";
import type { RefreshLock } from "@/lib/auth/index.ts";
import { createRustApiSessionProvider } from "@/rust-api/main/auth.ts";
import {
  createMemoryTokenStore,
  createRustApiClient,
} from "@/rust-api/shared/client.ts";

const NOW = 2_000_000_000_000;

/** Builds a JSON response for a fake fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

/** Creates a channel that does nothing. */
function createQuietChannel(): SessionChannel {
  return {
    publish() {},
    subscribe() {
      return () => {};
    },
    close() {},
  };
}

describe("rust-api session provider", () => {
  it("redirects the browser to the OIDC login route", async () => {
    const navigate = vi.fn();
    const tokens = createMemoryTokenStore("old-token");
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(),
      tokens,
    });
    const provider = createRustApiSessionProvider({ client, navigate });

    await provider.login();

    expect(navigate).toHaveBeenCalledWith("https://api.test/auth/login");
    expect(tokens.getToken()).toBeNull();
  });

  it("returns the session from the session guard", async () => {
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ sub: "user-1", iss: "issuer", aud: ["app"], exp: 2000 }),
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });
    const provider = createRustApiSessionProvider({
      client,
      navigate: vi.fn(),
    });

    const session = await provider.getSession();

    expect(session).toEqual({
      user: { id: "user-1" },
      expiresAt: 2_000_000,
    });
    expect(fakeFetch).toHaveBeenCalledWith(
      "https://api.test/auth/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("returns null when the session guard rejects the request", async () => {
    const fakeFetch = vi.fn(async () =>
      jsonResponse({ error: "unauthorized" }, 401),
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });
    const provider = createRustApiSessionProvider({
      client,
      navigate: vi.fn(),
    });

    await expect(provider.getSession()).resolves.toBeNull();
  });

  it("stores the token from a refresh and reloads the session", async () => {
    const tokens = createMemoryTokenStore();
    const fakeFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          expect(init?.method).toBe("POST");

          return jsonResponse({
            success: true,
            token: "new-token",
            error: null,
          });
        }

        return jsonResponse({
          sub: "user-2",
          iss: "issuer",
          aud: ["app"],
          exp: 3000,
        });
      },
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
      tokens,
    });
    const provider = createRustApiSessionProvider({
      client,
      navigate: vi.fn(),
    });

    const session = await provider.refresh();

    expect(tokens.getToken()).toBe("new-token");
    expect(session).toEqual({
      user: { id: "user-2" },
      expiresAt: 3_000_000,
    });
  });

  it("clears the token and returns null on a rejected refresh", async () => {
    const tokens = createMemoryTokenStore("old-token");
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () => jsonResponse({ error: "expired" }, 401)),
      tokens,
    });
    const provider = createRustApiSessionProvider({
      client,
      navigate: vi.fn(),
    });

    await expect(provider.refresh()).resolves.toBeNull();
    expect(tokens.getToken()).toBeNull();
  });

  it("clears the token on logout", async () => {
    const tokens = createMemoryTokenStore("old-token");
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.method).toBe("POST");

        return new Response(null, { status: 204 });
      },
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
      tokens,
    });
    const provider = createRustApiSessionProvider({
      client,
      navigate: vi.fn(),
    });

    await provider.logout();

    expect(tokens.getToken()).toBeNull();
  });

  it("loads the cached session when the network is down", async () => {
    const cache = createSessionCache(createMemorySessionStorage());
    cache.write({
      userId: "user-1",
      expiresAt: NOW - 1_000,
      lastVerifiedAt: NOW - 1_000,
      epoch: 1,
    });
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () => {
        throw new TypeError("The network is down.");
      }),
    });
    const provider = createRustApiSessionProvider({
      cache,
      client,
      navigate: vi.fn(),
      now: () => NOW,
    });

    const session = await provider.getSession();

    expect(session?.user.id).toBe("user-1");
    expect(session?.expiresAt).toBeGreaterThan(NOW);
  });

  it("does not load a cached session after the grace window", async () => {
    const cache = createSessionCache(createMemorySessionStorage());
    cache.write({
      userId: "user-1",
      expiresAt: NOW - 1_000,
      lastVerifiedAt: NOW - DEFAULT_OFFLINE_GRACE_MS - 1,
      epoch: 1,
    });
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () => {
        throw new TypeError("The network is down.");
      }),
    });
    const provider = createRustApiSessionProvider({
      cache,
      client,
      navigate: vi.fn(),
      now: () => NOW,
    });

    await expect(provider.getSession()).rejects.toBeInstanceOf(SessionError);
  });

  it("uses the cached session when the server returns 503", async () => {
    const cache = createSessionCache(createMemorySessionStorage());
    cache.write({
      userId: "user-1",
      expiresAt: NOW - 1_000,
      lastVerifiedAt: NOW - 1_000,
      epoch: 1,
    });
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () => jsonResponse({ error: "unavailable" }, 503)),
    });
    const provider = createRustApiSessionProvider({
      cache,
      client,
      navigate: vi.fn(),
      now: () => NOW,
    });

    const session = await provider.getSession();

    expect(session?.user.id).toBe("user-1");
  });

  it("does not use the cached session when the server returns 403", async () => {
    const cache = createSessionCache(createMemorySessionStorage());
    cache.write({
      userId: "user-1",
      expiresAt: NOW - 1_000,
      lastVerifiedAt: NOW - 1_000,
      epoch: 1,
    });
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () => jsonResponse({ error: "forbidden" }, 403)),
    });
    const provider = createRustApiSessionProvider({
      cache,
      client,
      navigate: vi.fn(),
      now: () => NOW,
    });

    await expect(provider.getSession()).rejects.toBeInstanceOf(SessionError);
  });

  it("clears the cache on logout", async () => {
    const cache = createSessionCache(createMemorySessionStorage());
    cache.write({
      userId: "user-1",
      expiresAt: NOW + 1_000,
      lastVerifiedAt: NOW,
      epoch: 1,
    });
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () => new Response(null, { status: 204 })),
    });
    const provider = createRustApiSessionProvider({
      cache,
      client,
      navigate: vi.fn(),
      now: () => NOW,
    });

    await provider.logout();

    expect(cache.read()).toBeNull();
  });

  it("clears the cache when the user id changes", async () => {
    const storage = createMemorySessionStorage();
    const remove = vi.spyOn(storage, "removeItem");
    const cache = createSessionCache(storage);
    cache.write({
      userId: "user-1",
      expiresAt: NOW + 1_000,
      lastVerifiedAt: NOW,
      epoch: 4,
    });
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () =>
        jsonResponse({
          sub: "user-2",
          iss: "issuer",
          aud: ["app"],
          exp: Math.floor(NOW / 1000) + 3_600,
        }),
      ),
    });
    const provider = createRustApiSessionProvider({
      cache,
      client,
      navigate: vi.fn(),
      now: () => NOW,
    });

    const session = await provider.getSession();

    expect(session?.user.id).toBe("user-2");
    expect(cache.read()?.userId).toBe("user-2");
    expect(cache.read()?.epoch).toBe(5);
    expect(remove).toHaveBeenCalledWith(SESSION_CACHE_KEY);
  });

  it("refreshes once when three tabs run at the same time", async () => {
    const cache = createSessionCache(createMemorySessionStorage());
    const lock = createSerialLock();
    const fakeFetch = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/auth/refresh")) {
          return jsonResponse({
            success: true,
            token: "new-token",
            error: null,
          });
        }

        return jsonResponse({
          sub: "user-1",
          iss: "issuer",
          aud: ["app"],
          exp: Math.floor(NOW / 1000) + 3_600,
        });
      },
    );
    const providers = [0, 1, 2].map(() =>
      createRustApiSessionProvider({
        cache,
        channel: createQuietChannel(),
        client: createRustApiClient({
          baseUrl: "https://api.test",
          fetch: fakeFetch,
        }),
        lock,
        now: () => NOW,
      }),
    );

    const sessions = await Promise.all(
      providers.map((provider) => provider.refresh()),
    );
    const refreshCalls = fakeFetch.mock.calls.filter(([input]) =>
      String(input).endsWith("/auth/refresh"),
    );

    expect(refreshCalls).toHaveLength(1);
    expect(sessions.map((session) => session?.user.id)).toEqual([
      "user-1",
      "user-1",
      "user-1",
    ]);
  });

  it("adds a safe return path to the login URL for a same-origin API", async () => {
    const returnToStorage = createMemorySessionStorage();
    const navigate = vi.fn();
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(),
    });
    const provider = createRustApiSessionProvider({
      client,
      navigate,
      returnToStorage,
      spaOrigin: "https://api.test",
    });

    await provider.login({ returnTo: "/team?tab=1#members" });

    expect(navigate).toHaveBeenCalledWith(
      "https://api.test/auth/login?return_to=%2Fteam%3Ftab%3D1%23members",
    );
    expect(returnToStorage.getItem(RETURN_TO_KEY)).toBeNull();
  });

  it("adds return_to for a relative API URL", async () => {
    const navigate = vi.fn();
    const client = createRustApiClient({
      baseUrl: "/api",
      fetch: vi.fn(),
    });
    const provider = createRustApiSessionProvider({
      client,
      navigate,
      spaOrigin: "https://app.test",
    });

    await provider.login({ returnTo: "/team" });

    expect(navigate).toHaveBeenCalledWith("/api/auth/login?return_to=%2Fteam");
  });

  it("does not send return_to when the API origin differs from the SPA", async () => {
    const returnToStorage = createMemorySessionStorage();
    const navigate = vi.fn();
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(),
    });
    const provider = createRustApiSessionProvider({
      client,
      navigate,
      returnToStorage,
      spaOrigin: "https://app.test",
    });

    await provider.login({ returnTo: "/team" });

    expect(returnToStorage.getItem(RETURN_TO_KEY)).toBe("/team");
    expect(navigate).toHaveBeenCalledWith("https://api.test/auth/login");
  });

  it.each([
    "https://evil.test/team",
    "//evil.test/team",
    "/\\evil.test/team",
    "/%5Cevil.test/team",
  ])("does not send an unsafe return path: %s", async (returnTo) => {
    const returnToStorage = createMemorySessionStorage();
    const navigate = vi.fn();
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(),
    });
    const provider = createRustApiSessionProvider({
      client,
      navigate,
      returnToStorage,
      spaOrigin: "https://api.test",
    });

    await provider.login({ returnTo });

    expect(navigate).toHaveBeenCalledWith("https://api.test/auth/login");
    expect(returnToStorage.getItem(RETURN_TO_KEY)).toBeNull();
  });

  it("clears an old return path when the login has no returnTo", async () => {
    const returnToStorage = createMemorySessionStorage();
    returnToStorage.setItem(RETURN_TO_KEY, "/old");
    const navigate = vi.fn();
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(),
    });
    const provider = createRustApiSessionProvider({
      client,
      navigate,
      returnToStorage,
      spaOrigin: "https://api.test",
    });

    await provider.login();

    expect(navigate).toHaveBeenCalledWith("https://api.test/auth/login");
    expect(returnToStorage.getItem(RETURN_TO_KEY)).toBeNull();
  });
});
