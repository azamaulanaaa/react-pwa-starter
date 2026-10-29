import { ApiError, apiErrorFromResponse } from "@/lib/api/error.ts";
import { createReplicaReader } from "@/lib/sync/index.ts";
import type {
  ReplicaManifestEntry,
  ReplicaReadOptions,
  ReplicaReader,
  ReplicaRequestOptions,
  ReplicaStatus,
  ReplicaTransport,
  ReplicaTransportReadResult,
} from "@/lib/sync/index.ts";

import type { RustApiClient } from "@/integrations/rust-api/client.ts";
import type {
  ReplicaManifest,
  SyncAdvanceResponse,
  SyncStatusResponse,
} from "@/integrations/rust-api/generated/index.ts";

/** Defines the options for the rust-api sync transport. */
export interface RustApiSyncOptions {
  /** The rust-api client. The client sends the session cookie. */
  client: RustApiClient;
}

/**
 * Defines the rust-api replica transport.
 * The transport keeps the rust-api manifest and ETag rules.
 * The generic reader in `src/lib/sync` does not hold these rules.
 */
export interface RustApiSyncTransport extends ReplicaTransport {
  /** Removes the cached status and manifest. The next calls fetch new data. */
  reset(): void;
}

/** Encodes one object key and keeps the path separators. */
function encodeObjectKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/** Maps one status body to the generic status. */
function toStatus(body: SyncStatusResponse): ReplicaStatus {
  const appliedSeq = body.applied_seq ?? 0;

  return {
    appliedSeq,
    head: body.head,
    pending: appliedSeq < body.head,
  };
}

/** Reports whether the body is a replica manifest. */
function isReplicaManifest(body: unknown): body is ReplicaManifest {
  return (
    typeof body === "object" &&
    body !== null &&
    "sst" in body &&
    Array.isArray(body.sst) &&
    "wal" in body &&
    Array.isArray(body.wal)
  );
}

/**
 * Returns the manifest entries in the manifest order.
 * The manifest has no per-object ETag, so the adapter uses a version token.
 * The first object read returns the server ETag.
 */
function toManifestEntries(manifest: ReplicaManifest): ReplicaManifestEntry[] {
  const version = String(manifest.version);
  const sst = manifest.sst.map((segment) => ({
    key: segment.id,
    etag: `manifest:${version}:${segment.id}`,
    size: segment.size,
  }));
  const wal = manifest.wal.map((key) => ({
    key,
    etag: `manifest:${version}:${key}`,
  }));

  return [...sst, ...wal];
}

/**
 * Creates the rust-api replica transport.
 * The transport caches the status and the manifest ETag.
 * The transport does not advance more than one step per call.
 */
export function createRustApiSyncTransport(
  options: RustApiSyncOptions,
): RustApiSyncTransport {
  const { client } = options;

  let cachedStatus: ReplicaStatus | null = null;
  let cachedStatusETag: string | null = null;
  let cachedManifest: ReplicaManifestEntry[] | null = null;
  let cachedManifestETag: string | null = null;

  const fetchStatus = async (
    requestOptions: ReplicaRequestOptions = {},
    conditional = true,
  ): Promise<ReplicaStatus> => {
    const headers = new Headers();
    if (conditional && cachedStatus !== null && cachedStatusETag !== null) {
      headers.set("If-None-Match", cachedStatusETag);
    }

    const response = await client.requestRaw("/sync/status", {
      headers,
      signal: requestOptions.signal,
    });

    if (response.status === 304) {
      if (cachedStatus === null) {
        throw new ApiError(
          "The sync failed. The server returned 304 without a cached status.",
          304,
        );
      }

      return cachedStatus;
    }

    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }

    const body = (await response.json()) as SyncStatusResponse;
    const status = toStatus(body);
    cachedStatus = status;
    cachedStatusETag = response.headers.get("ETag");

    return status;
  };

  return {
    status: (requestOptions) => fetchStatus(requestOptions),

    async advance(requestOptions = {}): Promise<ReplicaStatus> {
      const response = await client.requestRaw("/sync/sync", {
        method: "POST",
        signal: requestOptions.signal,
      });

      if (!response.ok) {
        throw await apiErrorFromResponse(response);
      }

      const body = (await response.json()) as SyncAdvanceResponse;
      const current = await fetchStatus(requestOptions, false);

      return {
        appliedSeq: body.applied_seq,
        head: current.head,
        pending: body.pending,
      };
    },

    async manifest(
      requestOptions = {},
    ): Promise<readonly ReplicaManifestEntry[]> {
      const headers = new Headers();
      if (cachedManifest !== null && cachedManifestETag !== null) {
        headers.set("If-None-Match", cachedManifestETag);
      }

      const response = await client.requestRaw("/sync/db/manifest.json", {
        headers,
        signal: requestOptions.signal,
      });

      if (response.status === 304) {
        if (cachedManifest === null) {
          throw new ApiError(
            "The sync failed. The server returned 304 without a cached manifest.",
            304,
          );
        }

        return cachedManifest;
      }

      if (!response.ok) {
        throw await apiErrorFromResponse(response);
      }

      const body = (await response.json()) as unknown;
      if (!isReplicaManifest(body)) {
        throw new ApiError(
          "The sync failed. The manifest is not valid.",
          response.status,
        );
      }

      const entries = toManifestEntries(body);
      cachedManifest = entries;
      cachedManifestETag = response.headers.get("ETag");

      return entries;
    },

    async readObject(
      key: string,
      readOptions: ReplicaReadOptions = {},
    ): Promise<ReplicaTransportReadResult> {
      const headers = new Headers();
      if (readOptions.etag !== undefined && readOptions.etag !== "") {
        headers.set("If-None-Match", readOptions.etag);
      }

      const response = await client.requestRaw(
        `/sync/db/${encodeObjectKey(key)}`,
        {
          headers,
          signal: readOptions.signal,
        },
      );

      if (response.status === 304) {
        const etag = response.headers.get("ETag") ?? readOptions.etag;

        return etag === undefined
          ? { kind: "not-modified" }
          : { kind: "not-modified", etag };
      }

      if (!response.ok) {
        throw await apiErrorFromResponse(response);
      }

      const data = new Uint8Array(await response.arrayBuffer());

      return {
        kind: "object",
        object: {
          key,
          etag: response.headers.get("ETag") ?? "",
          data,
        },
      };
    },

    reset(): void {
      cachedStatus = null;
      cachedStatusETag = null;
      cachedManifest = null;
      cachedManifestETag = null;
    },
  };
}

/**
 * Creates the rust-api replica reader.
 * The reader uses the generic contract in `src/lib/sync`.
 * The transport keeps the rust-api manifest and ETag rules.
 */
export function createRustApiReplicaReader(
  options: RustApiSyncOptions,
): ReplicaReader {
  return createReplicaReader(createRustApiSyncTransport(options));
}
