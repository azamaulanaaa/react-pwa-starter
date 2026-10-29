import { describe, expect, it, vi } from "vitest";

import { createReplicaReader } from "@/lib/sync/reader.ts";
import type {
  ReplicaReadOptions,
  ReplicaTransport,
  ReplicaTransportReadResult,
} from "@/lib/sync/types.ts";

/** Builds a fake transport for a test. */
function createFakeTransport(
  overrides: Partial<ReplicaTransport> = {},
): ReplicaTransport {
  return {
    status: vi.fn(async () => ({ appliedSeq: 3, head: 5, pending: true })),
    advance: vi.fn(async () => ({ appliedSeq: 5, head: 5, pending: false })),
    manifest: vi.fn(async () => [
      { key: "primary", etag: 'W/"7f3a"', size: 16 },
    ]),
    readObject: vi.fn(async (): Promise<ReplicaTransportReadResult> => ({
      kind: "object",
      object: {
        key: "primary",
        etag: 'W/"7f3a"',
        data: new Uint8Array([1, 2, 3]),
      },
    })),
    ...overrides,
  };
}

describe("createReplicaReader", () => {
  it("returns the applied sequence, the head, and the pending flag", async () => {
    const reader = createReplicaReader(createFakeTransport());

    const status = await reader.status();

    expect(status).toEqual({ appliedSeq: 3, head: 5, pending: true });
  });

  it("advances a pending replica and returns the new status", async () => {
    const transport = createFakeTransport();
    const reader = createReplicaReader(transport);

    const status = await reader.advance();

    expect(transport.advance).toHaveBeenCalledOnce();
    expect(status).toEqual({ appliedSeq: 5, head: 5, pending: false });
  });

  it("returns the replica object list", async () => {
    const reader = createReplicaReader(createFakeTransport());

    const manifest = await reader.manifest();

    expect(manifest).toEqual([{ key: "primary", etag: 'W/"7f3a"', size: 16 }]);
  });

  it("returns an object with its opaque ETag", async () => {
    const reader = createReplicaReader(createFakeTransport());

    const result = await reader.readObject("primary");

    expect(result).toEqual({
      kind: "object",
      object: {
        key: "primary",
        etag: 'W/"7f3a"',
        data: new Uint8Array([1, 2, 3]),
      },
    });
  });

  it("sends the ETag on a conditional read", async () => {
    const readObject = vi.fn(
      async (
        _key: string,
        _options?: ReplicaReadOptions,
      ): Promise<ReplicaTransportReadResult> => ({
        kind: "object",
        object: {
          key: "primary",
          etag: 'W/"8b41"',
          data: new Uint8Array([4]),
        },
      }),
    );
    const reader = createReplicaReader(createFakeTransport({ readObject }));

    await reader.readObject("primary", { etag: 'W/"7f3a"' });

    expect(readObject).toHaveBeenCalledWith("primary", { etag: 'W/"7f3a"' });
  });

  it("returns a not-modified result for a 304 response", async () => {
    const readObject = vi.fn(async (): Promise<ReplicaTransportReadResult> => ({
      kind: "not-modified",
      etag: 'W/"7f3a"',
    }));
    const reader = createReplicaReader(createFakeTransport({ readObject }));

    const result = await reader.readObject("primary", { etag: 'W/"7f3a"' });

    expect(result).toEqual({ kind: "not-modified", etag: 'W/"7f3a"' });
  });

  it("uses the request ETag when a 304 response has none", async () => {
    const readObject = vi.fn(async (): Promise<ReplicaTransportReadResult> => ({
      kind: "not-modified",
    }));
    const reader = createReplicaReader(createFakeTransport({ readObject }));

    const result = await reader.readObject("primary", { etag: 'W/"7f3a"' });

    expect(result).toEqual({ kind: "not-modified", etag: 'W/"7f3a"' });
  });

  it("rejects a read with an empty object key", async () => {
    const reader = createReplicaReader(createFakeTransport());

    const read = reader.readObject("  ");

    await expect(read).rejects.toThrow(
      "The read failed. The object key is empty.",
    );
  });

  it("rejects a conditional read with an empty ETag", async () => {
    const reader = createReplicaReader(createFakeTransport());

    const read = reader.readObject("primary", { etag: "" });

    await expect(read).rejects.toThrow("The read failed. The ETag is empty.");
  });

  it("rejects a 304 response without an ETag", async () => {
    const readObject = vi.fn(async (): Promise<ReplicaTransportReadResult> => ({
      kind: "not-modified",
    }));
    const reader = createReplicaReader(createFakeTransport({ readObject }));

    const read = reader.readObject("primary");

    await expect(read).rejects.toThrow(
      "The read failed. The not-modified result has no ETag.",
    );
  });

  it("rejects an object without an ETag", async () => {
    const readObject = vi.fn(async (): Promise<ReplicaTransportReadResult> => ({
      kind: "object",
      object: { key: "primary", etag: "", data: new Uint8Array() },
    }));
    const reader = createReplicaReader(createFakeTransport({ readObject }));

    const read = reader.readObject("primary");

    await expect(read).rejects.toThrow(
      "The read failed. The object has no ETag.",
    );
  });
});
