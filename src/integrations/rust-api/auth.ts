import { ApiError, apiErrorFromResponse } from "@/lib/api/error.ts";
import { SessionError, toSessionError } from "@/lib/auth/index.ts";
import type {
  LoginOptions,
  Session,
  SessionProvider,
} from "@/lib/auth/index.ts";
import {
  clearSessionCache,
  createSessionCache,
  DEFAULT_OFFLINE_GRACE_MS,
  sessionFromCache,
  writeSessionCache,
  type SessionCache,
  type SessionCacheStorage,
} from "@/lib/auth/cache.ts";
import {
  createSessionChannel,
  DEFAULT_SESSION_CHANNEL,
  type SessionChannel,
} from "@/lib/auth/channel.ts";
import {
  createRefreshCoordinator,
  type RefreshLock,
} from "@/lib/auth/refresh.ts";
import {
  browserSessionStorage,
  clearReturnTo,
  rememberReturnTo,
  safeReturnTo,
  type ReturnToStorage,
} from "@/lib/auth/return-to.ts";

import type {
  AuthResponse,
  MeResponse,
} from "@/integrations/rust-api/generated/index.ts";
import type { RustApiClient } from "@/integrations/rust-api/client.ts";

/** The default time limit for the session check. The value is five seconds. */
export const DEFAULT_SESSION_TIMEOUT_MS = 5_000;

/** Defines the options for the rust-api session provider. */
export interface RustApiSessionOptions {
  /** The rust-api client. The client carries the cookie mode and the token store. */
  client: RustApiClient;
  /** Opens one URL. The default uses `window.location.assign`. */
  navigate?: (url: string) => void;
  /** The session cache. The default uses local storage. */
  cache?: SessionCache;
  /** The storage for the session cache. The option is ignored when `cache` is present. */
  cacheStorage?: SessionCacheStorage;
  /** The cross-tab session channel. The default uses the browser channel. */
  channel?: SessionChannel;
  /** The refresh lock. The default uses `navigator.locks` or a storage mutex. */
  lock?: RefreshLock;
  /** The storage for the login return path. The default uses session storage. */
  returnToStorage?: ReturnToStorage;
  /** The SPA origin. The default uses the browser origin. */
  spaOrigin?: string;
  /** Returns the current time. The default is `Date.now`. */
  now?: () => number;
  /** The offline grace window in milliseconds. The default is seven days. */
  graceMs?: number;
  /** The network timeout in milliseconds. The default is five seconds. */
  timeoutMs?: number;
}

/** Opens one URL in the browser. */
function openLocation(url: string): void {
  if (typeof window === "undefined") {
    throw new SessionError(
      "The login failed. The browser location is not available.",
    );
  }

  window.location.assign(url);
}

/** Returns the origin of the current browser page. The function returns null outside a browser. */
function browserOrigin(): string | null {
  if (typeof window === "undefined") return null;

  return window.location.origin;
}

/** Returns the origin of a URL. The function returns null for an invalid URL. */
function originOf(value: string | null): string | null {
  if (value === null || value === "") return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Reports whether a URL has the same origin as the SPA.
 * The function returns false when the SPA origin is unknown or the URL is invalid.
 */
function isSameOrigin(url: string, spaOrigin: string | null): boolean {
  if (spaOrigin === null) return false;

  try {
    return new URL(url, spaOrigin).origin === spaOrigin;
  } catch {
    return false;
  }
}

/** Adds the return path to a login URL as an encoded query parameter. */
function withReturnTo(url: string, returnTo: string): string {
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}return_to=${encodeURIComponent(returnTo)}`;
}

/** Reads a JSON body and reports a session error when the body is not JSON. */
async function readJson<T>(response: Response, message: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new SessionError(message, { cause });
  }
}

/** Reports whether the body has the fields of a session probe response. */
function isMeResponse(body: unknown): body is MeResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    "sub" in body &&
    typeof body.sub === "string" &&
    "exp" in body &&
    typeof body.exp === "number"
  );
}

/**
 * Reports whether the caller can use the cached session.
 * A network failure, a timeout, and a `5xx` response can use the cache.
 * A `401`, a `403`, and a `404` must not use the cache.
 */
function canUseCachedSession(cause: unknown): boolean {
  if (cause instanceof ApiError) {
    return (
      cause.status === null || (cause.status >= 500 && cause.status <= 599)
    );
  }

  if (cause instanceof Error) {
    return (
      cause.name === "AbortError" ||
      cause.name === "TimeoutError" ||
      cause.name === "NetworkError"
    );
  }

  return false;
}

/** Runs one call with a time limit. The function aborts the call when the limit passes. */
async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new ApiError(
          "The session check failed. The network request timed out.",
          null,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Creates the rust-api session provider.
 * The provider uses the OIDC redirect and the `auth_token` cookie.
 * The provider caches session metadata and shares one refresh across tabs.
 */
export function createRustApiSessionProvider(
  options: RustApiSessionOptions,
): SessionProvider {
  const { client } = options;
  const navigate = options.navigate ?? openLocation;
  const now = options.now ?? Date.now;
  const graceMs = options.graceMs ?? DEFAULT_OFFLINE_GRACE_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS;
  const cache =
    options.cache ?? createSessionCache(options.cacheStorage ?? undefined);
  const returnToStorage = options.returnToStorage ?? browserSessionStorage();
  const spaOrigin = originOf(options.spaOrigin ?? browserOrigin());
  const channel =
    options.channel ?? createSessionChannel(DEFAULT_SESSION_CHANNEL);
  const coordinator = createRefreshCoordinator({
    cache,
    channel,
    lock: options.lock,
    now,
    graceMs,
  });

  /** Reads the session from the network. The function does not change the cache. */
  const fetchSession = async (): Promise<Session | null> => {
    const response = await withTimeout(timeoutMs, (signal) =>
      client.requestRaw("/auth/me", {
        headers: { Accept: "application/json" },
        signal,
      }),
    );

    if (response.status === 401) return null;

    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }

    const body = await readJson<unknown>(
      response,
      "The session check failed. The response is not valid JSON.",
    );

    if (!isMeResponse(body)) {
      throw new SessionError(
        "The session check failed. The response has no valid identity.",
      );
    }

    return {
      user: { id: body.sub },
      expiresAt: body.exp * 1000,
    };
  };

  /** Stores one verified session and sends it to the other tabs. */
  const storeSession = (session: Session): Session => {
    const record = writeSessionCache(cache, session, now());
    channel.publish({ session, epoch: record.epoch });

    return session;
  };

  /** Clears the cache and sends the logout to the other tabs. */
  const dropSession = (): void => {
    const epoch = clearSessionCache(cache);
    channel.publish({ session: null, epoch });
  };

  const getSession = async (): Promise<Session | null> => {
    try {
      const session = await fetchSession();

      if (session === null) {
        dropSession();

        return null;
      }

      return storeSession(session);
    } catch (cause) {
      if (canUseCachedSession(cause)) {
        const record = cache.read();
        const cached =
          record === null
            ? null
            : sessionFromCache(record, { now: now(), graceMs });

        if (cached !== null) return cached;
      }

      throw toSessionError(cause);
    }
  };

  return {
    getSession,

    async login(loginOptions?: LoginOptions): Promise<void> {
      client.tokens.setToken(null);

      const loginUrl = client.url("/auth/login");
      const returnTo = safeReturnTo(loginOptions?.returnTo);

      clearReturnTo(returnToStorage);

      // The upstream 302 uses the API origin. Send return_to only when that
      // origin is also the SPA origin, so the browser lands on the SPA.
      if (returnTo !== null && isSameOrigin(loginUrl, spaOrigin)) {
        navigate(withReturnTo(loginUrl, returnTo));

        return;
      }

      // A cross-origin API cannot redirect to the SPA. Keep the path for the
      // next SPA mount instead. The user returns to the SPA manually.
      rememberReturnTo(returnTo ?? undefined, returnToStorage);
      navigate(loginUrl);
    },

    async logout(): Promise<void> {
      try {
        const response = await client.requestRaw("/auth/logout", {
          method: "POST",
        });

        if (!response.ok) {
          throw await apiErrorFromResponse(response);
        }
      } finally {
        client.tokens.setToken(null);
        dropSession();
      }
    },

    async refresh(): Promise<Session | null> {
      try {
        return await coordinator.refresh(async () => {
          const response = await client.requestRaw("/auth/refresh", {
            method: "POST",
            headers: { Accept: "application/json" },
          });

          if (response.status === 401) {
            client.tokens.setToken(null);

            return null;
          }

          if (!response.ok) {
            client.tokens.setToken(null);
            throw toSessionError(await apiErrorFromResponse(response));
          }

          const body = await readJson<AuthResponse>(
            response,
            "The session refresh failed. The response is not valid JSON.",
          );

          if (!body.success || body.token === null || body.token === "") {
            client.tokens.setToken(null);

            return null;
          }

          client.tokens.setToken(body.token);

          return fetchSession();
        });
      } catch (cause) {
        throw toSessionError(cause);
      }
    },
  };
}
