import { describe, expect, it, vi } from "vitest";

import {
  createRustApiBackend,
  createRustApiBackendIfEnabled,
  isRustApiEnabled,
} from "@/integrations/rust-api/backend.ts";
import { createMemoryTokenStore } from "@/integrations/rust-api/client.ts";

/** Builds a JSON response for a fake fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("rust-api backend", () => {
  it("shares one client and one token store across session, replica, and files", async () => {
    const tokens = createMemoryTokenStore();
    const fakeFetch = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/auth/refresh")) {
          return jsonResponse({
            success: true,
            token: "shared-token",
            error: null,
          });
        }

        if (url.endsWith("/auth/me")) {
          return jsonResponse({
            sub: "user-1",
            iss: "issuer",
            aud: ["app"],
            exp: Math.floor(Date.now() / 1000) + 3_600,
          });
        }

        if (url.endsWith("/sync/status")) {
          return jsonResponse({ prefix: "p", applied_seq: 1, head: 2 });
        }

        if (url.endsWith("/fs/files/file-1/meta")) {
          return jsonResponse({
            id: "file-1",
            name: "note.txt",
            mimetype: "text/plain",
            size: 3,
          });
        }

        return jsonResponse({ error: "unexpected request" }, 500);
      },
    );
    const backend = createRustApiBackend({
      env: { VITE_RUST_API_BASE_URL: "https://api.test" },
      fetch: fakeFetch,
      tokens,
    });

    expect(backend.client.tokens).toBe(tokens);

    await backend.session.refresh();
    expect(backend.client.tokens.getToken()).toBe("shared-token");

    await backend.replica.status();
    await backend.files.metadata("file-1");

    const syncCall = fakeFetch.mock.calls.find(([input]) =>
      String(input).endsWith("/sync/status"),
    );
    const fileCall = fakeFetch.mock.calls.find(([input]) =>
      String(input).endsWith("/fs/files/file-1/meta"),
    );

    expect(syncCall).toBeDefined();
    expect(fileCall).toBeDefined();
    expect(new Headers(syncCall?.[1]?.headers).get("Authorization")).toBe(
      "Bearer shared-token",
    );
    expect(new Headers(fileCall?.[1]?.headers).get("Authorization")).toBe(
      "Bearer shared-token",
    );
  });

  it("keeps the switch off by default and sends no rust-api request", () => {
    const fakeFetch = vi.fn(async () => jsonResponse({ ready: true }));

    expect(isRustApiEnabled({})).toBe(false);
    expect(isRustApiEnabled({ VITE_RUST_API_ENABLED: "false" })).toBe(false);
    expect(
      createRustApiBackendIfEnabled({ env: {}, fetch: fakeFetch }),
    ).toBeNull();
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it.each(["1", "true", "yes", "on"])(
    "creates the backend when the switch is %s",
    (value) => {
      const backend = createRustApiBackendIfEnabled({
        env: {
          VITE_RUST_API_ENABLED: value,
          VITE_RUST_API_BASE_URL: "https://api.test",
        },
        fetch: vi.fn(),
      });

      expect(backend?.client.baseUrl).toBe("https://api.test");
    },
  );

  it.each([undefined, "", "   "])(
    "uses the local default when the base URL is %s",
    (value) => {
      const backend = createRustApiBackend({
        env: value === undefined ? {} : { VITE_RUST_API_BASE_URL: value },
        fetch: vi.fn(),
      });

      expect(backend.client.baseUrl).toBe("http://localhost:8080");
    },
  );

  it("strips the trailing slashes from the base URL", () => {
    const backend = createRustApiBackend({
      env: { VITE_RUST_API_BASE_URL: "https://api.test///" },
      fetch: vi.fn(),
    });

    expect(backend.client.baseUrl).toBe("https://api.test");
  });
});
