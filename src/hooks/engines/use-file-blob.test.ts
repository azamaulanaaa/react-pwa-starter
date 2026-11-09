// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFileBlob } from "@/hooks/engines/use-file-blob.ts";

const { getFile, worker } = vi.hoisted(() => {
  const get = vi.fn();
  return { getFile: get, worker: { fs: { Get: get } } };
});

vi.mock("@/components/context/worker.tsx", () => ({
  useWorker: () => worker,
}));

const createObjectUrl = vi.fn(() => "blob:file-url");
const revokeObjectUrl = vi.fn();

beforeEach(() => {
  getFile.mockReset();
  createObjectUrl.mockClear();
  revokeObjectUrl.mockClear();

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectUrl,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectUrl,
    writable: true,
  });
});

describe("useFileBlob", () => {
  it("creates an object URL for a stored file and revokes it on unmount", async () => {
    getFile.mockResolvedValue({
      blob: new Blob(["data"]),
      id: "file_1",
      mimetype: "text/plain",
      name: "file.txt",
      size: 4,
    });

    const { result, unmount } = renderHook(() => useFileBlob("file_1"));

    await waitFor(() => {
      expect(result.current).toEqual({ status: "ready", url: "blob:file-url" });
    });
    expect(getFile).toHaveBeenCalledWith("file_1");
    expect(createObjectUrl).toHaveBeenCalledTimes(1);

    unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:file-url");
  });

  it("returns the missing state for a null file id", () => {
    const { result } = renderHook(() => useFileBlob(null));

    expect(result.current).toEqual({ status: "missing", url: null });
    expect(getFile).not.toHaveBeenCalled();
  });

  it("returns the missing state when the file does not exist", async () => {
    getFile.mockResolvedValue(null);

    const { result } = renderHook(() => useFileBlob("missing_1"));

    await waitFor(() => {
      expect(result.current).toEqual({ status: "missing", url: null });
    });
  });

  it("returns the error state when the worker call fails", async () => {
    getFile.mockRejectedValue(new Error("The worker failed."));

    const { result } = renderHook(() => useFileBlob("broken_1"));

    await waitFor(() => {
      expect(result.current).toEqual({ status: "error", url: null });
    });
  });
});
