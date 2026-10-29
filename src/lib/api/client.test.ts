import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/lib/api/client.ts";
import { ApiError } from "@/lib/api/error.ts";

/** Builds a JSON response for a fake fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createApiClient", () => {
  it("returns typed data for a successful request", async () => {
    const fakeFetch = vi.fn(async () =>
      jsonResponse({ id: 7, name: "Sample" }),
    );
    const client = createApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });

    const data = await client.request<{ id: number; name: string }>("/items/7");

    expect(data).toEqual({ id: 7, name: "Sample" });
    expect(fakeFetch).toHaveBeenCalledWith(
      "https://api.test/items/7",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns an ApiError with the status and server message", async () => {
    const fakeFetch = vi.fn(async () =>
      jsonResponse({ error: "The item is missing." }, 404),
    );
    const client = createApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });

    const request = client.request("/items/404");

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 404,
      message: "The item is missing.",
    });
  });

  it("returns an ApiError when the network request fails", async () => {
    const fakeFetch = vi.fn(async () => {
      throw new TypeError("connection refused");
    });
    const client = createApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });

    const request = client.request("/items");

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: null,
      message: "The request failed. The network request did not complete.",
    });
  });

  it("adds a bearer header when a token exists", async () => {
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ ok: true }),
    );
    const client = createApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
      tokenProvider: { getToken: async () => "token-value" },
    });

    await client.request("/items");

    const init = fakeFetch.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);

    expect(headers.get("Authorization")).toBe("Bearer token-value");
  });

  it("does not add a bearer header when the token is absent", async () => {
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ ok: true }),
    );
    const client = createApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
      tokenProvider: { getToken: () => null },
    });

    await client.request("/items");

    const init = fakeFetch.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);

    expect(headers.has("Authorization")).toBe(false);
  });

  it("sends a JSON body with the request method", async () => {
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ id: 8 }, 201),
    );
    const client = createApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });

    await client.request("/items", {
      method: "POST",
      body: { name: "Sample" },
    });

    const init = fakeFetch.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);

    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ name: "Sample" }));
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
