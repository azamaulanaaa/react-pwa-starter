// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  type NestedRecord,
  TranslationProvider,
} from "@/components/context/translation.tsx";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/editor/markdown-editor.tsx";
import type {
  ImageUploadHandler,
  ImageUploadResult,
} from "@/components/editor/image-upload.ts";

import enDictionary from "~/public/locales/en-US.json" with { type: "json" };

// The inserted image reads the missing state. The plugin never calls the worker.
vi.mock("@/hooks/engines/use-file-blob.ts", () => ({
  useFileBlob: () => ({ status: "missing", url: null }),
}));

/** Adds the translation context to one test tree. */
function Providers({ children }: { children: ReactNode }) {
  const dictionary = enDictionary as NestedRecord;

  return (
    <TranslationProvider
      dictionary={dictionary}
      fallbackDictionary={dictionary}
    >
      {children}
    </TranslationProvider>
  );
}

/** Returns one promise that the test resolves or rejects. */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

/** Shows one editor with one image upload handler. */
function renderEditor(onUploadImage: ImageUploadHandler) {
  const ref = createRef<MarkdownEditorHandle>();
  const onChange = vi.fn();
  const view = render(
    <Providers>
      <MarkdownEditor
        ref={ref}
        ariaLabel="Note body"
        onChange={onChange}
        onUploadImage={onUploadImage}
        value="Alpha\n"
      />
    </Providers>,
  );

  return { ...view, onChange, ref };
}

/** Selects one file in the hidden file input. */
function selectFile(file: File): HTMLInputElement {
  const input = screen.getByLabelText("Image file") as HTMLInputElement;

  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  fireEvent.change(input);

  return input;
}

describe("ImagePlugin", () => {
  it("uploads a selected file and inserts the image", async () => {
    const deferred = createDeferred<ImageUploadResult>();
    const handler = vi.fn<ImageUploadHandler>(() => deferred.promise);
    const { ref } = renderEditor(handler);
    const file = new File(["image"], "diagram.png", { type: "image/png" });

    selectFile(file);

    await screen.findByText("Uploading image…");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toBe(file);
    expect(handler.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal);

    deferred.resolve({ alt: "Diagram", id: "file_01" });

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain("![Diagram](/fs/file_01)");
    });

    expect(screen.queryByText("Image unavailable")).not.toBeNull();
  });

  it("announces the upload status in one live region", async () => {
    const deferred = createDeferred<ImageUploadResult>();
    const handler = vi.fn<ImageUploadHandler>(() => deferred.promise);
    renderEditor(handler);
    const status = screen.getByRole("status");

    expect(status.textContent).toBe("");

    selectFile(new File(["image"], "diagram.png", { type: "image/png" }));

    await screen.findByText("Uploading image…");
    expect(status.textContent).toBe("Uploading image…");
    expect(screen.getAllByRole("status")).toHaveLength(1);

    deferred.resolve({ alt: "Diagram", id: "file_01" });

    await waitFor(() => {
      expect(status.textContent).toBe("");
    });
  });

  it("shows the error and inserts nothing when the upload fails", async () => {
    const handler = vi.fn<ImageUploadHandler>(() =>
      Promise.reject(new Error("The test upload failed.")),
    );
    const { ref } = renderEditor(handler);

    selectFile(new File(["image"], "diagram.png", { type: "image/png" }));

    const status = screen.getByRole("status");

    await waitFor(() => {
      expect(status.textContent).toBe("The image upload failed. Try again.");
    });

    expect(ref.current?.getMarkdown()).not.toContain("/fs/");
    expect(document.querySelector('[data-slot="image-node"]')).toBeNull();
  });

  it("stops the upload when the editor closes", async () => {
    const deferred = createDeferred<ImageUploadResult>();
    const handler = vi.fn<ImageUploadHandler>(() => deferred.promise);
    const { unmount } = renderEditor(handler);

    selectFile(new File(["image"], "diagram.png", { type: "image/png" }));

    await screen.findByText("Uploading image…");

    const signal = handler.mock.calls[0]?.[1].signal;

    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it("stops the upload when the file picker closes", async () => {
    const deferred = createDeferred<ImageUploadResult>();
    const handler = vi.fn<ImageUploadHandler>(() => deferred.promise);
    renderEditor(handler);
    const input = selectFile(
      new File(["image"], "diagram.png", { type: "image/png" }),
    );

    await screen.findByText("Uploading image…");

    const signal = handler.mock.calls[0]?.[1].signal;

    fireEvent(input, new Event("cancel"));

    expect(signal?.aborted).toBe(true);
  });
});
