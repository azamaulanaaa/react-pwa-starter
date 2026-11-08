// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IntlProvider } from "@/components/context/intl.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import {
  FileUpload,
  toFileMetadata,
  uploadsComplete,
  type FileUploadProps,
} from "@/components/upload/file-upload.tsx";
import type { FileMetadata } from "@/hooks/primitives/use-file-upload.ts";

const DICTIONARY = {
  upload_add_files: "Add files",
  upload_choose_files: "Upload files",
  upload_drop_title: "Drop your files here",
  upload_files_title: "Files ({{count}})",
  upload_limit_one: "Max 1 file · Up to {{maxSize}}",
  upload_limits: "Max {{maxFiles}} files · Up to {{maxSize}}",
  upload_remove_all: "Remove all",
  upload_remove_file: "Remove {{name}}",
  upload_select_files: "Select files",
};

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

const createObjectURL = vi.fn(() => "blob:preview-1");
const revokeObjectURL = vi.fn();

beforeEach(() => {
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

function renderUpload(props: FileUploadProps = {}) {
  return render(
    <TranslationProvider
      dictionary={DICTIONARY}
      fallbackDictionary={DICTIONARY}
    >
      <IntlProvider>
        <FileUpload {...props} />
      </IntlProvider>
    </TranslationProvider>,
  );
}

function getInput(): HTMLInputElement {
  return screen.getByLabelText("Upload files") as HTMLInputElement;
}

function addFile(file: File): void {
  fireEvent.change(getInput(), { target: { files: [file] } });
}

describe("FileUpload", () => {
  it("shows the empty state", () => {
    renderUpload();

    expect(screen.getByText("Drop your files here")).toBeDefined();
    expect(screen.getByText("Max 6 files · Up to 5MB")).toBeDefined();
    expect(screen.getByRole("button", { name: "Select files" })).toBeDefined();
  });

  it("shows the initial files and the remove buttons", () => {
    renderUpload({ initialFiles: INITIAL_FILES });

    expect(screen.getByText("Files (2)")).toBeDefined();
    expect(screen.getByText("photo.png")).toBeDefined();
    expect(screen.getByText("archive.zip")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Remove photo.png" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Remove archive.zip" }),
    ).toBeDefined();
  });

  it("clears all files and returns to the empty state", () => {
    const onFilesChange = vi.fn();
    renderUpload({ initialFiles: INITIAL_FILES, onFilesChange });

    fireEvent.click(screen.getByRole("button", { name: "Remove all" }));

    expect(screen.getByText("Drop your files here")).toBeDefined();
    expect(onFilesChange).toHaveBeenLastCalledWith([]);
  });

  it("removes one file and keeps the other files", () => {
    const onFilesChange = vi.fn();
    renderUpload({ initialFiles: INITIAL_FILES, onFilesChange });

    fireEvent.click(screen.getByRole("button", { name: "Remove photo.png" }));

    expect(screen.queryByText("photo.png")).toBeNull();
    expect(screen.getByText("archive.zip")).toBeDefined();
    expect(onFilesChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "zip-1" }),
    ]);
  });

  it("shows an error for a large file", () => {
    renderUpload({ maxSize: 8 });

    addFile(
      new File(["0123456789abcdef"], "large.txt", { type: "text/plain" }),
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/exceed the maximum size/);
  });

  it("calls onFilesAdded for a valid file", () => {
    const onFilesAdded = vi.fn();
    renderUpload({ maxSize: 1024, onFilesAdded });

    addFile(new File(["data"], "photo.png", { type: "image/png" }));

    expect(onFilesAdded).toHaveBeenCalledTimes(1);
    expect(onFilesAdded.mock.calls[0][0]).toHaveLength(1);
    expect(onFilesAdded.mock.calls[0][0][0].file.name).toBe("photo.png");
    expect(screen.getByText("Files (1)")).toBeDefined();
  });

  it("disables the buttons and the input", () => {
    renderUpload({ disabled: true, initialFiles: INITIAL_FILES });

    expect(
      screen
        .getByRole("button", { name: "Add files" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Remove all" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Remove photo.png" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(getInput().disabled).toBe(true);
  });

  it("shows the overlay for a file below full progress", () => {
    renderUpload({
      initialFiles: [INITIAL_FILES[0]],
      progressByFileId: { "image-1": 0.42 },
    });

    expect(
      document.querySelector('[data-slot="file-upload-progress"]'),
    ).not.toBeNull();
    expect(screen.getByText("42%")).toBeDefined();
  });

  it("hides the overlay when the progress is 1", () => {
    renderUpload({
      initialFiles: [INITIAL_FILES[0]],
      progressByFileId: { "image-1": 1 },
    });

    expect(
      document.querySelector('[data-slot="file-upload-progress"]'),
    ).toBeNull();
  });

  it("shows the upload error text from the props", () => {
    const message = "The upload failed. Try again.";

    renderUpload({
      errorsByFileId: { "image-1": message },
      initialFiles: [INITIAL_FILES[0]],
    });

    expect(screen.getByText(message)).toBeDefined();
  });

  it("disables add, remove all, and select while busy", () => {
    renderUpload({ busy: true, initialFiles: INITIAL_FILES });

    expect(
      screen
        .getByRole("button", { name: "Add files" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Remove all" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Remove photo.png" })
        .hasAttribute("disabled"),
    ).toBe(false);
    expect(getInput().disabled).toBe(true);
  });

  it("removes one file while an upload runs", () => {
    const onFilesChange = vi.fn();

    renderUpload({
      busy: true,
      initialFiles: [INITIAL_FILES[0]],
      onFilesChange,
      progressByFileId: { "image-1": 0.42 },
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove photo.png" }));

    expect(screen.queryByText("photo.png")).toBeNull();
    expect(onFilesChange).toHaveBeenLastCalledWith([]);
  });

  it("keeps the file metadata outside the progress overlay", () => {
    renderUpload({
      initialFiles: [INITIAL_FILES[0]],
      progressByFileId: { "image-1": 0.42 },
    });

    const overlay = document.querySelector(
      '[data-slot="file-upload-progress"]',
    );

    expect(overlay).not.toBeNull();
    expect(within(overlay as HTMLElement).queryByText("photo.png")).toBeNull();
    expect(screen.getByText("photo.png")).toBeDefined();
  });
});

describe("toFileMetadata", () => {
  it("returns only the file metadata for a form submit", () => {
    const file = new File(["data"], "photo.png", { type: "image/png" });

    const result = toFileMetadata([
      { id: "file-1", file, preview: "blob:preview-1" },
    ]);

    expect(result).toEqual([
      {
        id: "file-1",
        name: "photo.png",
        size: file.size,
        type: "image/png",
      },
    ]);
  });
});

describe("uploadsComplete", () => {
  it("reports upload completion for empty and partial lists", () => {
    const file = new File(["data"], "photo.png", { type: "image/png" });
    const files = [{ id: "file-1", file }];

    expect(uploadsComplete([], {})).toBe(true);
    expect(uploadsComplete(files, { "file-1": 1 })).toBe(true);
    expect(uploadsComplete(files, { "file-1": 0.5 })).toBe(false);
  });
});
