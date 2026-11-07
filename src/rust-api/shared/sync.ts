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

import type { RustApiClient } from "./client.ts";
import type {
  ReplicaManifest,
  SyncAdvanceResponse,
  SyncStatusResponse,
} from "./generated/index.ts";

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
  /** Removes all cached data. The next calls fetch new data. */
  reset(): void;
}

/** Encodes one object key and keeps the path separators. */
function encodeObjectKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Maps one status body to the generic status.
 * `ReplicaStatus.appliedSeq` stays a number, so a null `applied_seq` maps to 0.
 * A null `applied_seq` means that no build ran. The adapter reports pending in that case,
 * because the first advance must run before `manifest.json` exists.
 */
function toStatus(body: SyncStatusResponse): ReplicaStatus {
  const appliedSeq = body.applied_seq ?? 0;

  return {
    appliedSeq,
    head: body.head,
    pending: body.applied_seq === null || body.applied_seq < body.head,
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
 * Reports whether an ETag is the synthetic token from a manifest entry.
 * The manifest has no per-object ETag, so the token cannot match the server ETag.
 */
function isManifestToken(etag: string, key: string): boolean {
  return etag.startsWith("manifest:") && etag.endsWith(`:${key}`);
}

/**
 * Returns the ETag to send in `If-None-Match`.
 * An explicit real ETag from the caller wins. A cached real ETag replaces the synthetic
 * manifest token or an absent ETag. The adapter sends the cached ETag for every object,
 * including an immutable object, so the server can return a `304` without a body.
 */
function selectRequestETag(
  key: string,
  requested: string | undefined,
  cached: string | undefined,
): string | undefined {
  if (requested !== undefined && requested !== "") {
    if (!isManifestToken(requested, key)) return requested;
  }

  return cached;
}

/**
 * Returns the manifest entries in the manifest order.
 * The manifest has no per-object ETag, so the adapter uses a version token.
 * The transport replaces the token with the real ETag from the first object read.
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
 * The transport caches the status, the manifest ETag, the advance response, and object ETags.
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
  let cachedAdvanceStatus: ReplicaStatus | null = null;
  let cachedAdvanceETag: string | null = null;
  const objectETags = new Map<string, string>();

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
      const headers = new Headers();
      if (cachedAdvanceStatus !== null && cachedAdvanceETag !== null) {
        headers.set("If-None-Match", cachedAdvanceETag);
      }

      const response = await client.requestRaw("/sync/sync", {
        method: "POST",
        headers,
        signal: requestOptions.signal,
      });

      if (response.status === 304) {
        if (cachedAdvanceStatus === null) {
          throw new ApiError(
            "The sync failed. The server returned 304 without a cached advance.",
            304,
          );
        }

        // The advance ETag covers `applied_seq` and `pending`, but not `head`. The head can
        // move after the first status call. Read the current head and recompute the reader
        // pending flag before the adapter returns the cached advance result.
        const current = await fetchStatus(requestOptions, false);
        const status: ReplicaStatus = {
          appliedSeq: cachedAdvanceStatus.appliedSeq,
          head: current.head,
          pending:
            cachedAdvanceStatus.pending ||
            cachedAdvanceStatus.appliedSeq < current.head,
        };

        cachedAdvanceStatus = status;
        return status;
      }

      if (!response.ok) {
        throw await apiErrorFromResponse(response);
      }

      const body = (await response.json()) as SyncAdvanceResponse;
      const current = await fetchStatus(requestOptions, false);

      // Upstream uses `pending` for a queued full rebuild. The reader uses `pending` for
      // changes to apply. Both conditions must set the reader flag.
      const status: ReplicaStatus = {
        appliedSeq: body.applied_seq,
        head: current.head,
        pending: body.pending || body.applied_seq < current.head,
      };

      cachedAdvanceStatus = status;
      cachedAdvanceETag = response.headers.get("ETag");

      return status;
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
      const cachedETag = objectETags.get(key);
      const requestETag = selectRequestETag(key, readOptions.etag, cachedETag);

      const headers = new Headers();
      if (requestETag !== undefined) {
        headers.set("If-None-Match", requestETag);
      }

      const response = await client.requestRaw(
        `/sync/db/${encodeObjectKey(key)}`,
        {
          headers,
          signal: readOptions.signal,
        },
      );

      if (response.status === 304) {
        const etag = response.headers.get("ETag") ?? requestETag;

        if (etag === undefined) {
          return { kind: "not-modified" };
        }

        objectETags.set(key, etag);
        return { kind: "not-modified", etag };
      }

      if (!response.ok) {
        throw await apiErrorFromResponse(response);
      }

      const data = new Uint8Array(await response.arrayBuffer());
      const etag = response.headers.get("ETag") ?? "";

      if (etag !== "") {
        objectETags.set(key, etag);
      }

      return {
        kind: "object",
        object: {
          key,
          etag,
          data,
        },
      };
    },

    reset(): void {
      cachedStatus = null;
      cachedStatusETag = null;
      cachedManifest = null;
      cachedManifestETag = null;
      cachedAdvanceStatus = null;
      cachedAdvanceETag = null;
      objectETags.clear();
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
