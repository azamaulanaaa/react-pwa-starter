import type {
  FileId,
  FileMetadata,
  UploadInit,
  UploadPartRef,
} from "@/lib/fs/schema.ts";

export type {
  FileId,
  FileMetadata,
  UploadInit,
  UploadPartRef,
} from "@/lib/fs/schema.ts";

/** Describes one stored file. The caller supplies the metadata. */
export interface FileRecord<TMetadata = FileMetadata> {
  /** The opaque file id. */
  id: FileId;
  /** The file size in bytes. */
  size: number;
  /** The metadata that the caller supplied at completion. */
  metadata: TMetadata;
}

/** Describes one open upload. */
export interface UploadSession {
  /** The opaque upload id. */
  id: FileId;
  /** The number of parts in the upload. */
  totalParts: number;
}

/** Reports the state of one upload. */
export interface UploadProgress {
  /** The opaque upload id. */
  id: FileId;
  /** The number of stored parts. */
  completedParts: number;
  /** The number of parts in the upload. */
  totalParts: number;
  /** The stored share of the file, from 0 to 100. */
  percent: number;
}

/** Defines the byte range for one download. */
export interface DownloadOptions {
  /** The first byte to read. The default is 0. */
  start?: number;
  /** The last byte to read. The default is the end of the file. */
  end?: number;
  /** The signal that cancels the download. */
  signal?: AbortSignal;
}

/** Returns one stored file and its content. */
export interface FileDownload<TMetadata = FileMetadata> {
  /** The file record. */
  file: FileRecord<TMetadata>;
  /** The file content. */
  blob: Blob;
}

/**
 * Defines a backend-neutral file transport.
 * A backend implements chunked uploads and downloads behind this interface.
 * The interface has no storage path or domain relation.
 */
export interface FileTransport<TMetadata = FileMetadata> {
  /**
   * Starts one upload.
   * The transport validates the declaration against the shared schema.
   */
  init(input: UploadInit): Promise<UploadSession>;

  /** Stores one part of an upload. */
  uploadPart(part: UploadPartRef, blob: Blob): Promise<void>;

  /** Finishes an upload and returns the stored file. */
  complete(id: FileId, metadata: TMetadata): Promise<FileRecord<TMetadata>>;

  /** Stops an upload and removes its parts. */
  cancel(id: FileId): Promise<void>;

  /** Returns the progress of one upload. */
  progress(id: FileId): Promise<UploadProgress>;

  /** Returns one stored file record. The result is null when the file is absent. */
  metadata(id: FileId): Promise<FileRecord<TMetadata> | null>;

  /** Returns one stored file and its content. */
  download(
    id: FileId,
    options?: DownloadOptions,
  ): Promise<FileDownload<TMetadata>>;

  /** Removes one stored file. */
  delete(id: FileId): Promise<void>;
}
