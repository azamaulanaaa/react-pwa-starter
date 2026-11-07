import { describe, expect, it, vi } from "vitest";

import { createMemoryTokenStore } from "@/rust-api/shared/client.ts";
import {
  createRustApiWorkerBackend,
  createRustApiWorkerBackendIfEnabled,
} from "@/rust-api/worker/backend.ts";

/** Builds a JSON response for a fake fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("rust-api worker backend", () => {
  it("shares one client and one token store across replica and files", async () => {
    const tokens = createMemoryTokenStore("shared-token");
    const fakeFetch = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);

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
    const backend = createRustApiWorkerBackend({
      env: { VITE_RUST_API_BASE_URL: "https://api.test" },
      fetch: fakeFetch,
      tokens,
    });

    expect(backend.client.tokens).toBe(tokens);

    await backend.replica.status();
    await backend.files.metadata("file-1");

    const syncCall = fakeFetch.mock.calls.find(([input]) =>
      String(input).endsWith("/sync/status"),
    );
    const fileCall = fakeFetch.mock.calls.find(([input]) =>
      String(input).endsWith("/fs/files/file-1/meta"),
    );

    expect(new Headers(syncCall?.[1]?.headers).get("Authorization")).toBe(
      "Bearer shared-token",
    );
    expect(new Headers(fileCall?.[1]?.headers).get("Authorization")).toBe(
      "Bearer shared-token",
    );
  });

  it("returns null when the switch is off and sends no request", () => {
    const fakeFetch = vi.fn(async () => jsonResponse({ ready: true }));

    expect(
      createRustApiWorkerBackendIfEnabled({ env: {}, fetch: fakeFetch }),
    ).toBeNull();
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("creates the backend when the switch is on and accepts the base URL", () => {
    const backend = createRustApiWorkerBackendIfEnabled({
      env: {
        VITE_RUST_API_ENABLED: "true",
        VITE_RUST_API_BASE_URL: "https://api.test",
      },
      fetch: vi.fn(),
    });

    expect(backend?.client.baseUrl).toBe("https://api.test");
  });
});
