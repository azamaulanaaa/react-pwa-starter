import { apiErrorFromResponse } from "@/lib/api/error.ts";
import { SessionError, toSessionError } from "@/lib/auth/index.ts";
import type { Session, SessionProvider } from "@/lib/auth/index.ts";

import type {
  AuthResponse,
  MeResponse,
} from "@/integrations/rust-api/generated/index.ts";
import type { RustApiClient } from "@/integrations/rust-api/client.ts";

/** Defines the options for the rust-api session provider. */
export interface RustApiSessionOptions {
  /** The rust-api client. The client carries the cookie mode and the token store. */
  client: RustApiClient;
  /** Opens one URL. The default uses `window.location.assign`. */
  navigate?: (url: string) => void;
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
 * Creates the rust-api session provider.
 * The provider uses the OIDC redirect and the `auth_token` cookie.
 * The provider keeps an optional in-memory copy of the callback token.
 */
export function createRustApiSessionProvider(
  options: RustApiSessionOptions,
): SessionProvider {
  const { client } = options;
  const navigate = options.navigate ?? openLocation;

  const getSession = async (): Promise<Session | null> => {
    const response = await client.requestRaw("/auth/me", {
      headers: { Accept: "application/json" },
    });

    if (response.status === 401) return null;

    if (!response.ok) {
      throw toSessionError(await apiErrorFromResponse(response));
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

  return {
    getSession,

    async login(): Promise<void> {
      client.tokens.setToken(null);
      navigate(client.url("/auth/login"));
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
      }
    },

    async refresh(): Promise<Session | null> {
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

      return getSession();
    },
  };
}
