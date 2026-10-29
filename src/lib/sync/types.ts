/**
 * Defines the ETag of one replica object.
 * The reader treats the ETag as an opaque string.
 * The reader does not parse the value.
 */
export type ReplicaETag = string;

/**
 * Defines the status of one replica.
 * The status does not contain domain data.
 */
export interface ReplicaStatus {
  /** The sequence number that the replica applied last. */
  appliedSeq: number;
  /** The latest sequence number that the transport reports. */
  head: number;
  /** The flag is true when the replica has changes to apply. */
  pending: boolean;
}

/**
 * Defines one entry in the replica manifest.
 * The entry gives the object key and the object ETag.
 * The reader does not interpret the object data.
 */
export interface ReplicaManifestEntry {
  /** The object key. The reader treats the key as an opaque string. */
  key: string;
  /** The ETag of the object. The reader treats the ETag as an opaque string. */
  etag: ReplicaETag;
  /**
   * The object size in bytes.
   * The value is absent when the transport does not report the size.
   */
  size?: number;
}

/**
 * Defines one replica object.
 * The reader does not interpret the data.
 */
export interface ReplicaObject {
  /** The object key. The reader treats the key as an opaque string. */
  key: string;
  /** The ETag of the object. The reader treats the ETag as an opaque string. */
  etag: ReplicaETag;
  /** The object bytes. The reader passes the bytes through without a change. */
  data: Uint8Array;
}

/**
 * Defines the result of one object read.
 * A not-modified result means that the caller holds the current copy.
 */
export type ReplicaReadResult =
  | { kind: "object"; object: ReplicaObject }
  | { kind: "not-modified"; etag: ReplicaETag };

/**
 * Defines the options for one replica request.
 */
export interface ReplicaRequestOptions {
  /** The signal that cancels the request. */
  signal?: AbortSignal;
}

/**
 * Defines the options for one object read.
 */
export interface ReplicaReadOptions extends ReplicaRequestOptions {
  /**
   * The ETag of the copy that the caller holds.
   * The function sends a conditional request when the value is present.
   */
  etag?: ReplicaETag;
}

/**
 * Defines the data source that the reader calls.
 * An adapter implements this interface for one backend.
 * The interface does not name a backend path or a manifest rule.
 */
export interface ReplicaTransport {
  /** Returns the replica status. The call does not advance the replica. */
  status(options?: ReplicaRequestOptions): Promise<ReplicaStatus>;
  /** Advances the replica and returns the new status. */
  advance(options?: ReplicaRequestOptions): Promise<ReplicaStatus>;
  /** Returns the replica object list. The reader does not interpret the data. */
  manifest(
    options?: ReplicaRequestOptions,
  ): Promise<readonly ReplicaManifestEntry[]>;
  /**
   * Reads one object with an optional conditional ETag.
   * The function returns a not-modified result when the object does not change.
   */
  readObject(
    key: string,
    options?: ReplicaReadOptions,
  ): Promise<ReplicaTransportReadResult>;
}

/**
 * Defines the raw result of one transport object read.
 * A 304 response maps to the not-modified kind.
 * The ETag is optional because a 304 response can omit the header.
 */
export type ReplicaTransportReadResult =
  | { kind: "object"; object: ReplicaObject }
  | { kind: "not-modified"; etag?: ReplicaETag };

/**
 * Defines the backend-neutral replica reader.
 * The reader returns status, advances the replica, lists objects, and reads objects.
 * The interface has no domain type.
 */
export interface ReplicaReader {
  /** Returns the replica status. The call does not advance the replica. */
  status(options?: ReplicaRequestOptions): Promise<ReplicaStatus>;
  /** Advances the replica and returns the new status. */
  advance(options?: ReplicaRequestOptions): Promise<ReplicaStatus>;
  /** Returns the replica object list. The reader does not interpret the data. */
  manifest(
    options?: ReplicaRequestOptions,
  ): Promise<readonly ReplicaManifestEntry[]>;
  /**
   * Reads one object with an optional conditional ETag.
   * The function returns a not-modified result when the object does not change.
   */
  readObject(
    key: string,
    options?: ReplicaReadOptions,
  ): Promise<ReplicaReadResult>;
}
