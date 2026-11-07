import { describe, expect, it, vi } from "vitest";

import {
  createMemoryTokenStore,
  createRustApiClient,
  resolveRustApiBaseUrl,
} from "@/rust-api/shared/client.ts";

/** Builds a JSON response for a fake fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("rust-api client", () => {
  it("sends the session cookie, the bearer token, and the base URL", async () => {
    const tokens = createMemoryTokenStore("token-value");
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ ready: true }),
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test/",
      fetch: fakeFetch,
      tokens,
    });

    const body = await client.request<{ ready: boolean }>("/health");

    expect(body).toEqual({ ready: true });
    expect(fakeFetch).toHaveBeenCalledWith(
      "https://api.test/health",
      expect.objectContaining({ credentials: "include" }),
    );
    const init = fakeFetch.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);

    expect(headers.get("Authorization")).toBe("Bearer token-value");
  });

  it("returns an ApiError with the server message", async () => {
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () =>
        jsonResponse({ error: "The request is not allowed." }, 403),
      ),
    });

    const request = client.request("/auth/me");

    await expect(request).rejects.toMatchObject({
      status: 403,
      message: "The request is not allowed.",
    });
  });

  it("returns the local default when the environment gives no URL", () => {
    expect(resolveRustApiBaseUrl("")).toBe("http://localhost:8080");
  });

  it("keeps request URLs relative for a same-origin base URL", () => {
    expect(resolveRustApiBaseUrl("/")).toBe("");
    expect(resolveRustApiBaseUrl("/api/")).toBe("/api");

    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ ready: true }),
    );
    const client = createRustApiClient({ baseUrl: "/", fetch: fakeFetch });

    expect(client.url("/auth/login")).toBe("/auth/login");
    expect(client.url("fs/list")).toBe("/fs/list");
  });
});
