/**
 * This module holds the rust-api wire types.
 * The rust-api repository does not commit an OpenAPI document at the inspected commit.
 * The types come from the route definitions and the response structs.
 *
 * Source: https://github.com/azamaulanaaa/rust-api
 * Commit: ff0a1fe76238c44774301653d3041f34712722c8
 * Files: src/oidc/route.rs, src/sync/route.rs, src/fs/route.rs, src/fs/model.rs
 *
 * To regenerate from a running server:
 *
 * curl -s http://localhost:8080/openapi.json -o /tmp/rust-api-openapi.json
 * npx openapi-typescript /tmp/rust-api-openapi.json \
 *   -o src/integrations/rust-api/generated/openapi.d.ts
 *
 * The adapter uses the small types below until the generated document replaces them.
 */

/** Defines the error body. The server sends one stable message. */
export interface ErrorBody {
  /** The stable error message. */
  error: string;
}

/** Defines the session probe response from `GET /auth/me`. */
export interface MeResponse {
  /** The stable user identifier. */
  sub: string;
  /** The issuer that minted the token. */
  iss: string;
  /** The audiences that the token names. */
  aud: string[];
  /** The expiry time in Unix seconds. */
  exp: number;
}

/** Defines the login callback and refresh response. */
export interface AuthResponse {
  /** The flag is true when authentication completed. */
  success: boolean;
  /** The validated token. The value is null on failure. */
  token: string | null;
  /** The failure reason. The value is null on success. */
  error: string | null;
}

/** Defines the upload declaration for `POST /fs/uploads`. */
export interface InitRequest {
  /** The total file size in bytes. */
  file_size: number;
  /** The part size in bytes. */
  part_size: number;
  /** The total part count. */
  file_total_parts: number;
}

/** Defines the upload response. */
export interface InitResponse {
  /** The generated upload identifier. */
  file_id: string;
}

/** Defines the completion body for `POST /fs/uploads/{id}/complete`. */
export interface CompleteRequest {
  /** The file name. */
  name: string;
  /** The MIME type. */
  mimetype: string;
}

/** Defines one stored file from `GET /fs/files/{id}/meta`. */
export interface FileMetadata {
  /** The file identifier. */
  id: string;
  /** The file name. */
  name: string;
  /** The MIME type. */
  mimetype: string;
  /** The file size in bytes. */
  size: number;
}

/** Defines the upload progress from `GET /fs/uploads/{id}`. */
export interface ProgressResponse {
  /** The upload identifier. */
  file_id: string;
  /** The total file size in bytes. */
  file_size: number;
  /** The part size in bytes. */
  part_size: number;
  /** The total part count. */
  total_parts: number;
  /** The part indexes that the server stored. */
  uploaded_parts: number[];
  /** The stored share of the file, from 0 to 100. */
  percent: number;
}

/** Defines the replica status from `GET /sync/status`. */
export interface SyncStatusResponse {
  /** The replica prefix for the caller. */
  prefix: string;
  /** The sequence that the replica applied. The value is null before the first build. */
  applied_seq: number | null;
  /** The current write-ahead log head. */
  head: number;
}

/** Defines the advance response from `POST /sync/sync`. */
export interface SyncAdvanceResponse {
  /** The replica prefix for the caller. */
  prefix: string;
  /** The sequence that the replica applied. */
  applied_seq: number;
  /** The flag is true when a full rebuild is queued or running. */
  pending: boolean;
}

/**
 * Defines one SST segment in `manifest.json`.
 * The `id` is the object key relative to the replica prefix.
 * The segment order in the array is load-bearing.
 */
export interface ManifestSst {
  /** The object key relative to the replica prefix. */
  id: string;
  /** The write order inside the epoch. */
  seq: number;
  /** The level. Level 0 overlaps and level 1 does not. */
  level: number;
  /** The lowest key in the segment. */
  minKey: string;
  /** The highest key in the segment. */
  maxKey: string;
  /** The segment size in bytes. */
  size: number;
}

/**
 * Defines the raw `manifest.json` document.
 * The document is not part of the OpenAPI schema.
 * The field names and the order rules come from oxkv 0.10.
 */
export interface ReplicaManifest {
  /** The manifest version. The value increases on every change. */
  version: number;
  /** The epoch that owns the replica. */
  epoch: number;
  /** The write-ahead log object keys. */
  wal: string[];
  /** The SST segments. The first segment is the oldest. */
  sst: ManifestSst[];
}
