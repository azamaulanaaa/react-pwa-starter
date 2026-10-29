import { Schema } from "effect";

import { ApiError, apiErrorFromResponse } from "@/lib/api/error.ts";
import {
  FileMetadataSchema,
  UploadInitSchema,
  type FileId,
  type FileMetadata,
  type UploadInit,
  type UploadPartRef,
} from "@/lib/fs/index.ts";
import type {
  DownloadOptions,
  FileDownload,
  FileRecord,
  FileTransport,
  UploadProgress,
  UploadSession,
} from "@/lib/fs/index.ts";

import type { RustApiClient } from "@/integrations/rust-api/client.ts";
import type {
  FileMetadata as RustApiFileMetadata,
  InitResponse,
  ProgressResponse,
} from "@/integrations/rust-api/generated/index.ts";

/** Defines the options for the rust-api file transport. */
export interface RustApiFileOptions {
  /** The rust-api client. The client sends the session cookie. */
  client: RustApiClient;
}

/** Maps one rust-api file record to the generic record. */
function toFileRecord(metadata: RustApiFileMetadata): FileRecord {
  return {
    id: metadata.id,
    size: metadata.size,
    metadata: {
      name: metadata.name,
      mimetype: metadata.mimetype,
    },
  };
}

/** Validates one upload declaration. */
function validateUpload(input: UploadInit): UploadInit {
  try {
    return Schema.decodeUnknownSync(UploadInitSchema)(input);
  } catch (cause) {
    throw new Error("The upload failed. The upload declaration is not valid.", {
      cause,
    });
  }
}

/** Validates one file metadata value. */
function validateMetadata(metadata: FileMetadata): FileMetadata {
  try {
    return Schema.decodeUnknownSync(FileMetadataSchema)(metadata);
  } catch (cause) {
    throw new Error("The upload failed. The file metadata is not valid.", {
      cause,
    });
  }
}

/**
 * Creates the rust-api file transport.
 * The transport maps the generic calls to the `/fs` routes.
 * The transport does not attach a file to a domain row.
 */
export function createRustApiFileTransport(
  options: RustApiFileOptions,
): FileTransport {
  const { client } = options;

  const metadata = async (id: FileId): Promise<FileRecord | null> => {
    const response = await client.requestRaw(
      `/fs/files/${encodeURIComponent(id)}/meta`,
      { headers: { Accept: "application/json" } },
    );

    if (response.status === 404) return null;

    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }

    const body = (await response.json()) as RustApiFileMetadata;

    return toFileRecord(body);
  };

  return {
    async init(input: UploadInit): Promise<UploadSession> {
      const body = validateUpload(input);
      const response = await client.request<InitResponse>("/fs/uploads", {
        method: "POST",
        json: body,
      });

      return {
        id: response.file_id,
        totalParts: body.file_total_parts,
      };
    },

    async uploadPart(part: UploadPartRef, blob: Blob): Promise<void> {
      const response = await client.requestRaw(
        `/fs/uploads/${encodeURIComponent(part.file_id)}/parts/${part.file_part}`,
        {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": "application/octet-stream" },
        },
      );

      if (!response.ok) {
        throw await apiErrorFromResponse(response);
      }
    },

    async complete(
      id: FileId,
      fileMetadata: FileMetadata,
    ): Promise<FileRecord> {
      const body = validateMetadata(fileMetadata);
      await client.request<InitResponse>(
        `/fs/uploads/${encodeURIComponent(id)}/complete`,
        { method: "POST", json: body },
      );

      const record = await metadata(id);
      if (record === null) {
        throw new ApiError(
          "The upload failed. The server did not return the file metadata.",
          null,
        );
      }

      return record;
    },

    async cancel(id: FileId): Promise<void> {
      const response = await client.requestRaw(
        `/fs/uploads/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw await apiErrorFromResponse(response);
      }
    },

    async progress(id: FileId): Promise<UploadProgress> {
      const body = await client.request<ProgressResponse>(
        `/fs/uploads/${encodeURIComponent(id)}`,
        { headers: { Accept: "application/json" } },
      );

      return {
        id: body.file_id,
        completedParts: body.uploaded_parts.length,
        totalParts: body.total_parts,
        percent: body.percent,
      };
    },

    metadata,

    async download(
      id: FileId,
      downloadOptions: DownloadOptions = {},
    ): Promise<FileDownload> {
      const record = await metadata(id);
      if (record === null) {
        throw new ApiError("The download failed. The file is absent.", 404);
      }

      const headers = new Headers();
      if (
        downloadOptions.start !== undefined ||
        downloadOptions.end !== undefined
      ) {
        const start = downloadOptions.start ?? 0;
        const end =
          downloadOptions.end === undefined ? "" : String(downloadOptions.end);
        headers.set("Range", `bytes=${start}-${end}`);
      }

      const response = await client.requestRaw(
        `/fs/files/${encodeURIComponent(id)}`,
        {
          headers,
          signal: downloadOptions.signal,
        },
      );

      if (response.status === 416) {
        throw new ApiError(
          "The download failed. The range is outside the file.",
          416,
        );
      }

      if (!response.ok) {
        throw await apiErrorFromResponse(response);
      }

      return { file: record, blob: await response.blob() };
    },

    async delete(id: FileId): Promise<void> {
      const response = await client.requestRaw(
        `/fs/files/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw await apiErrorFromResponse(response);
      }
    },
  };
}
