// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { createHeadlessEditor } from "@lexical/headless";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from "@lexical/markdown";
import { $nodesOfType } from "lexical";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type NestedRecord,
  TranslationProvider,
} from "@/components/context/translation.tsx";
import {
  $createImageNode,
  $isImageNode,
  ImageNode,
  type SerializedImageNode,
} from "@/components/editor/image-node.tsx";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/editor/markdown-editor.tsx";
import { MARKDOWN_EDITOR_NODES } from "@/components/editor/nodes.ts";
import { MARKDOWN_TRANSFORMERS } from "@/components/editor/transformers.ts";
import { canonicalize } from "@/lib/markdown/index.ts";

import enDictionary from "~/public/locales/en-US.json" with { type: "json" };

const { getFile, worker, workerState } = vi.hoisted(() => {
  const get = vi.fn();
  return {
    getFile: get,
    worker: { fs: { Get: get } },
    workerState: { available: true },
  };
});

vi.mock("@/components/context/worker.tsx", () => ({
  useOptionalWorker: () => (workerState.available ? worker : null),
}));

const IMAGE_MARKDOWN = "![Diagram](/fs/file_01)";

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

/** Creates a headless editor for the image node tests. */
function createEditor() {
  return createHeadlessEditor({
    namespace: "ImageNodeTest",
    nodes: MARKDOWN_EDITOR_NODES,
    onError: (error) => {
      throw error;
    },
  });
}

/** Shows one editor with one Markdown value. */
function renderEditor(
  value: string,
  resolveImageFile?: (fileId: string) => Promise<Blob | null>,
) {
  const ref = createRef<MarkdownEditorHandle>();

  return render(
    <Providers>
      <MarkdownEditor
        ref={ref}
        ariaLabel="Note body"
        onChange={vi.fn()}
        resolveImageFile={resolveImageFile}
        value={value}
        variant="full"
      />
    </Providers>,
  );
}

beforeEach(() => {
  workerState.available = true;
  getFile.mockReset();
  getFile.mockResolvedValue(null);
});

describe("ImageNode", () => {
  it("round-trips its values through JSON", () => {
    const editor = createEditor();
    let serialized: SerializedImageNode | null = null;
    const result: { restored: ImageNode | null } = { restored: null };

    editor.update(
      () => {
        const node = $createImageNode({
          alt: "Diagram",
          src: "/fs/file_01",
          title: "A diagram",
        });

        serialized = node.exportJSON();
        result.restored = ImageNode.importJSON(serialized);
      },
      { discrete: true },
    );

    expect(serialized).toMatchObject({
      alt: "Diagram",
      src: "/fs/file_01",
      title: "A diagram",
      type: "image",
      version: 1,
    });
    expect(result.restored).not.toBeNull();
    expect($isImageNode(result.restored)).toBe(true);
    expect(result.restored?.getTextContent()).toBe("Diagram");
  });

  it("round-trips one image through the Markdown transformer", () => {
    const editor = createEditor();
    let output = "";
    let alt = "";

    editor.update(
      () => {
        $convertFromMarkdownString(IMAGE_MARKDOWN, MARKDOWN_TRANSFORMERS);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const images = $nodesOfType(ImageNode);

      expect(images).toHaveLength(1);
      alt = images[0]?.getTextContent() ?? "";
      output = canonicalize($convertToMarkdownString(MARKDOWN_TRANSFORMERS));
    });

    expect(alt).toBe("Diagram");
    expect(output).toBe(`${IMAGE_MARKDOWN}\n`);
  });

  it("shows the alt text when the file is missing", async () => {
    renderEditor(IMAGE_MARKDOWN);

    expect(await screen.findByText("Image unavailable")).toBeDefined();
    expect(screen.getByText("Diagram")).toBeDefined();
    expect(getFile).toHaveBeenCalledWith("file_01");
  });

  it("does not crash when the worker provider is absent", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    workerState.available = false;

    try {
      renderEditor(IMAGE_MARKDOWN);

      expect(await screen.findByText("Image unavailable")).toBeDefined();
      expect(screen.getByText("Diagram")).toBeDefined();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("shows the alt text when the resolver returns null", async () => {
    workerState.available = false;
    const resolver = vi.fn(async () => null);

    renderEditor(IMAGE_MARKDOWN, resolver);

    expect(await screen.findByText("Image unavailable")).toBeDefined();
    expect(screen.getByText("Diagram")).toBeDefined();
    expect(resolver).toHaveBeenCalledWith("file_01");
  });

  it("shows the selection state after a click", async () => {
    const { container } = renderEditor(IMAGE_MARKDOWN);
    const content = container.querySelector(".image-node-content");

    expect(content).not.toBeNull();

    fireEvent.click(content as Element);

    await waitFor(() => {
      expect(content?.getAttribute("data-selected")).toBe("true");
    });
  });
});
