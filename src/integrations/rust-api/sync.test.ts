import { describe, expect, it, vi } from "vitest";

import { createRustApiClient } from "@/integrations/rust-api/client.ts";
import { createRustApiReplicaReader } from "@/integrations/rust-api/sync.ts";

/** Builds a JSON response for a fake fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("rust-api replica reader", () => {
  it("returns the cached status for a 304 response", async () => {
    let calls = 0;
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        calls += 1;

        if (calls === 1) {
          return new Response(
            JSON.stringify({ prefix: "p", applied_seq: 2, head: 5 }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ETag: '"snap-2-h5"',
              },
            },
          );
        }

        expect(new Headers(init?.headers).get("If-None-Match")).toBe(
          '"snap-2-h5"',
        );

        return new Response(null, {
          status: 304,
          headers: { ETag: '"snap-2-h5"' },
        });
      },
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });
    const reader = createRustApiReplicaReader({ client });

    const first = await reader.status();
    const second = await reader.status();

    expect(first).toEqual({ appliedSeq: 2, head: 5, pending: true });
    expect(second).toEqual(first);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it("returns pending from an advance call", async () => {
    const fakeFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/sync/sync")) {
          expect(init?.method).toBe("POST");

          return jsonResponse({ prefix: "p", applied_seq: 3, pending: true });
        }

        return jsonResponse({ prefix: "p", applied_seq: 3, head: 5 });
      },
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });
    const reader = createRustApiReplicaReader({ client });

    const status = await reader.advance();

    expect(status).toEqual({ appliedSeq: 3, head: 5, pending: true });
  });

  it("keeps the manifest order and reuses the manifest ETag", async () => {
    let calls = 0;
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        calls += 1;

        if (calls === 1) {
          return new Response(
            JSON.stringify({
              version: 7,
              epoch: 3,
              wal: ["e000003/wal/00000007.log"],
              sst: [
                {
                  id: "e000003/sst/L0/00000009.sst",
                  seq: 9,
                  level: 0,
                  minKey: "a",
                  maxKey: "z",
                  size: 128,
                },
              ],
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ETag: '"manifest-7"',
              },
            },
          );
        }

        expect(new Headers(init?.headers).get("If-None-Match")).toBe(
          '"manifest-7"',
        );

        return new Response(null, {
          status: 304,
          headers: { ETag: '"manifest-7"' },
        });
      },
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });
    const reader = createRustApiReplicaReader({ client });

    const first = await reader.manifest();
    const second = await reader.manifest();

    expect(first.map((entry) => entry.key)).toEqual([
      "e000003/sst/L0/00000009.sst",
      "e000003/wal/00000007.log",
    ]);
    expect(first[0]?.size).toBe(128);
    expect(second).toEqual(first);
  });

  it("returns a not-modified object for a 304 response", async () => {
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(new Headers(init?.headers).get("If-None-Match")).toBe('"v1"');

        return new Response(null, {
          status: 304,
          headers: { ETag: '"v1"' },
        });
      },
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });
    const reader = createRustApiReplicaReader({ client });

    const result = await reader.readObject("e000003/sst/L0/00000009.sst", {
      etag: '"v1"',
    });

    expect(result).toEqual({ kind: "not-modified", etag: '"v1"' });
  });

  it("reads one object and keeps the path separators", async () => {
    const fakeFetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        "https://api.test/sync/db/e000003/sst/L0/00000009.sst",
      );

      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { ETag: '"v2"' },
      });
    });
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });
    const reader = createRustApiReplicaReader({ client });

    const result = await reader.readObject("e000003/sst/L0/00000009.sst");

    expect(result).toEqual({
      kind: "object",
      object: {
        key: "e000003/sst/L0/00000009.sst",
        etag: '"v2"',
        data: new Uint8Array([1, 2, 3]),
      },
    });
  });
});
