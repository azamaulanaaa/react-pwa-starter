// @vitest-environment jsdom
import { StrictMode, createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type FileMetadata,
  useFileUpload,
} from "@/hooks/primitives/use-file-upload.ts";

let previewCount = 0;
const createObjectURL = vi.fn(() => `blob:preview-${++previewCount}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  previewCount = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
    writable: true,
  });
});

afterEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

const INITIAL_FILES: FileMetadata[] = [
  {
    id: "image-1",
    name: "photo.png",
    size: 120,
    type: "image/png",
    url: "data:image/png;base64,initial",
  },
  {
    id: "zip-1",
    name: "archive.zip",
    size: 240,
    type: "application/zip",
    url: "https://example.com/archive.zip",
  },
];

function makeFile(name: string, type: string, content = "test"): File {
  return new File([content], name, { type });
}

describe("useFileUpload", () => {
  it("loads the initial files with previews", () => {
    const { result } = renderHook(() =>
      useFileUpload({ initialFiles: INITIAL_FILES, multiple: true }),
    );

    const [state] = result.current;

    expect(state.files).toHaveLength(2);
    expect(state.files[0]).toMatchObject({
      id: "image-1",
      preview: "data:image/png;base64,initial",
    });
    expect(state.files[1]).toMatchObject({
      id: "zip-1",
      preview: "https://example.com/archive.zip",
    });
  });

  it("adds a valid image file with a preview", () => {
    const { result } = renderHook(() =>
      useFileUpload({ multiple: true, maxSize: 1024 }),
    );
    const file = makeFile("photo.png", "image/png");

    act(() => result.current[1].addFiles([file]));

    const [state] = result.current;

    expect(state.errors).toEqual([]);
    expect(state.files).toHaveLength(1);
    expect(state.files[0].file).toBe(file);
    expect(state.files[0].preview).toBe("blob:preview-1");
  });

  it("reports an error for a file above the maximum size", () => {
    const { result } = renderHook(() =>
      useFileUpload({ multiple: true, maxSize: 8 }),
    );
    const file = makeFile("large.txt", "text/plain", "0123456789abcdef");

    act(() => result.current[1].addFiles([file]));

    const [state] = result.current;

    expect(state.files).toEqual([]);
    expect(state.errors[0]).toMatch(/exceed the maximum size/);
  });

  it("reports an error for more files than the maximum", () => {
    const { result } = renderHook(() =>
      useFileUpload({ multiple: true, maxFiles: 1 }),
    );

    act(() =>
      result.current[1].addFiles([
        makeFile("one.txt", "text/plain"),
        makeFile("two.txt", "text/plain"),
      ]),
    );

    const [state] = result.current;

    expect(state.files).toEqual([]);
    expect(state.errors[0]).toBe("The maximum number of files is 1.");
  });

  it("reports an error for a file outside the accept rule", () => {
    const { result } = renderHook(() =>
      useFileUpload({ accept: "image/*", multiple: true }),
    );

    act(() =>
      result.current[1].addFiles([makeFile("notes.txt", "text/plain")]),
    );

    const [state] = result.current;

    expect(state.files).toEqual([]);
    expect(state.errors[0]).toBe(
      'File "notes.txt" is not an accepted file type.',
    );
  });

  it("removes a file and releases its preview URL", () => {
    const { result } = renderHook(() =>
      useFileUpload({ multiple: true, maxSize: 1024 }),
    );

    act(() => result.current[1].addFiles([makeFile("photo.png", "image/png")]));

    const id = result.current[0].files[0].id;

    act(() => result.current[1].removeFile(id));

    expect(result.current[0].files).toEqual([]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
  });

  it("clears all files and releases their preview URLs", () => {
    const { result } = renderHook(() =>
      useFileUpload({ multiple: true, maxSize: 1024 }),
    );

    act(() =>
      result.current[1].addFiles([
        makeFile("one.png", "image/png"),
        makeFile("two.png", "image/png"),
      ]),
    );

    act(() => result.current[1].clearFiles());

    expect(result.current[0].files).toEqual([]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-2");
  });

  it("calls onFilesChange on add and remove", () => {
    const onFilesChange = vi.fn();
    const { result } = renderHook(() =>
      useFileUpload({ multiple: true, maxSize: 1024, onFilesChange }),
    );

    act(() => result.current[1].addFiles([makeFile("photo.png", "image/png")]));

    expect(onFilesChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ preview: "blob:preview-1" }),
    ]);

    const id = result.current[0].files[0].id;

    act(() => result.current[1].removeFile(id));

    expect(onFilesChange).toHaveBeenLastCalledWith([]);
  });

  it("calls onFilesChange one time under StrictMode", () => {
    const onFilesChange = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);
    const { result } = renderHook(
      () => useFileUpload({ multiple: true, maxSize: 1024, onFilesChange }),
      { wrapper },
    );

    act(() => result.current[1].addFiles([makeFile("photo.png", "image/png")]));

    expect(onFilesChange).toHaveBeenCalledTimes(1);
  });

  it("returns the input props with the type, accept, and multiple values", () => {
    const { result } = renderHook(() =>
      useFileUpload({ accept: "image/png", multiple: true }),
    );

    const props = result.current[1].getInputProps();

    expect(props.type).toBe("file");
    expect(props.accept).toBe("image/png");
    expect(props.multiple).toBe(true);
  });
});
