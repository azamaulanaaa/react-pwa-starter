import { describe, expect, it, vi } from "vitest";

import { createRustApiSessionProvider } from "@/integrations/rust-api/auth.ts";
import {
  createMemoryTokenStore,
  createRustApiClient,
} from "@/integrations/rust-api/client.ts";

/** Builds a JSON response for a fake fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
});
