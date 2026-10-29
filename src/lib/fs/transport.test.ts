import { describe, expect, it, vi } from "vitest";

import type {
  DownloadOptions,
  FileRecord,
  FileTransport,
  UploadInit,
  UploadPartRef,
} from "@/lib/fs/index.ts";

type Meta = { label: string };

const UPLOAD_ID = "upload-1";
const FILE_ID = "file-1";

function makeBackend() {
  const file: FileRecord<Meta> = {
    id: FILE_ID,
    size: 4,
    metadata: { label: "test" },
  };

  const backend = {
    init: vi.fn(
      async (
        _input: UploadInit,
      ): Promise<{ id: string; totalParts: number }> => ({
        id: UPLOAD_ID,
        totalParts: 1,
      }),
    ),
    uploadPart: vi.fn(
      async (_part: UploadPartRef, _blob: Blob): Promise<void> => {},
    ),
    complete: vi.fn(
      async (_id: string, _metadata: Meta): Promise<FileRecord<Meta>> => file,
    ),
    cancel: vi.fn(async (_id: string): Promise<void> => {}),
    progress: vi.fn(async (_id: string) => ({
      id: UPLOAD_ID,
      completedParts: 1,
      totalParts: 1,
      percent: 100,
    })),
    metadata: vi.fn(
      async (_id: string): Promise<FileRecord<Meta> | null> => file,
    ),
    download: vi.fn(async (_id: string, _options?: DownloadOptions) => ({
      file,
      blob: new Blob(["test"]),
    })),
    delete: vi.fn(async (_id: string): Promise<void> => {}),
  } satisfies FileTransport<Meta>;

  return { backend, file };
}

/**
 * Wraps one transport and calls the backend for each method.
 * The wrapper lets the test check that no call is lost.
 */
function forwardTo(backend: FileTransport<Meta>): FileTransport<Meta> {
  return {
    init: (input) => backend.init(input),
    uploadPart: (part, blob) => backend.uploadPart(part, blob),
    complete: (id, metadata) => backend.complete(id, metadata),
    cancel: (id) => backend.cancel(id),
    progress: (id) => backend.progress(id),
    metadata: (id) => backend.metadata(id),
    download: (id, options) => backend.download(id, options),
    delete: (id) => backend.delete(id),
  };
}

describe("file transport contract", () => {
  it("forwards each transport call to the backend", async () => {
    const { backend, file } = makeBackend();
    const transport = forwardTo(backend);

    const init: UploadInit = {
      file_size: 4,
      part_size: 4,
      file_total_parts: 1,
    };
    const part: UploadPartRef = {
      file_id: UPLOAD_ID,
      file_total_part: 1,
      file_part: 0,
    };
    const blob = new Blob(["test"]);
    const metadata: Meta = { label: "test" };
    const options = { start: 0, end: 1 };

    await expect(transport.init(init)).resolves.toEqual({
      id: UPLOAD_ID,
      totalParts: 1,
    });
    await transport.uploadPart(part, blob);
    await expect(transport.complete(UPLOAD_ID, metadata)).resolves.toBe(file);
    await transport.cancel(UPLOAD_ID);
    await expect(transport.progress(UPLOAD_ID)).resolves.toMatchObject({
      percent: 100,
    });
    await expect(transport.metadata(FILE_ID)).resolves.toBe(file);
    await expect(transport.download(FILE_ID, options)).resolves.toMatchObject({
      file,
    });
    await transport.delete(FILE_ID);

    expect(backend.init).toHaveBeenCalledWith(init);
    expect(backend.uploadPart).toHaveBeenCalledWith(part, blob);
    expect(backend.complete).toHaveBeenCalledWith(UPLOAD_ID, metadata);
    expect(backend.cancel).toHaveBeenCalledWith(UPLOAD_ID);
    expect(backend.progress).toHaveBeenCalledWith(UPLOAD_ID);
    expect(backend.metadata).toHaveBeenCalledWith(FILE_ID);
    expect(backend.download).toHaveBeenCalledWith(FILE_ID, options);
    expect(backend.delete).toHaveBeenCalledWith(FILE_ID);
  });

  it("returns null when the file is absent", async () => {
    const { backend } = makeBackend();
    backend.metadata.mockResolvedValueOnce(null);
    const transport = forwardTo(backend);

    await expect(transport.metadata(FILE_ID)).resolves.toBeNull();
  });
});
