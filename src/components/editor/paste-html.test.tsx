// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { $getRoot, $isElementNode, type LexicalEditor } from "lexical";
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

import enDictionary from "~/public/locales/en-US.json" with { type: "json" };

// The editor tests do not start a worker. The image node reads the missing state.
vi.mock("@/hooks/engines/use-file-blob.ts", () => ({
  useFileBlob: () => ({ status: "missing", url: null }),
}));

// jsdom does not define the clipboard event classes. Lexical reads them.
if (typeof ClipboardEvent === "undefined") {
  class TestClipboardEvent extends Event {}
  globalThis.ClipboardEvent =
    TestClipboardEvent as unknown as typeof ClipboardEvent;
}

if (typeof DragEvent === "undefined") {
  class TestDragEvent extends Event {
    dataTransfer = null;
  }
  globalThis.DragEvent = TestDragEvent as unknown as typeof DragEvent;
}

// jsdom does not measure a DOM Range. The editor reads the range on focus.
if (typeof Range !== "undefined") {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}

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

/** Returns one clipboard data object for a paste event. */
function createClipboardData(parts: Record<string, string>): DataTransfer {
  return {
    files: [],
    getData: (type: string) => parts[type] ?? "",
    types: Object.keys(parts),
  } as unknown as DataTransfer;
}

/** Renders one editor and returns its handle and textbox. */
function renderEditor() {
  const ref = createRef<MarkdownEditorHandle>();

  render(
    <Providers>
      <MarkdownEditor
        ref={ref}
        ariaLabel="Note body"
        onChange={() => {}}
        value=""
      />
    </Providers>,
  );

  const textbox = screen.getByRole("textbox", { name: "Note body" });
  const editor = (textbox as HTMLElement & { __lexicalEditor: LexicalEditor })
    .__lexicalEditor;

  return { editor, ref, textbox };
}

/** Moves the caret to the start of the first block. */
function selectStart(editor: LexicalEditor): void {
  act(() => {
    editor.update(
      () => {
        const first = $getRoot().getFirstChild();

        if (first !== null && $isElementNode(first)) {
          first.selectStart();
        } else {
          $getRoot().selectEnd();
        }
      },
      { discrete: true },
    );
  });
}

/** Sends one HTML paste event and waits for the editor update to settle. */
async function pasteHtml(textbox: HTMLElement, html: string): Promise<void> {
  fireEvent.paste(textbox, {
    clipboardData: createClipboardData({ "text/plain": "", "text/html": html }),
  });

  await act(async () => {
    await Promise.resolve();
  });
}

describe("HTML paste", () => {
  it("imports bold HTML as Markdown strong text", async () => {
    const { editor, ref, textbox } = renderEditor();

    selectStart(editor);
    await pasteHtml(textbox, "<b>bold</b>");

    expect(ref.current?.getMarkdown()).toContain("**bold**");
  });

  it("drops a script element and its content", async () => {
    const { editor, ref, textbox } = renderEditor();

    selectStart(editor);
    await pasteHtml(textbox, "<script>alert(1)</script>");

    expect(document.querySelector("script")).toBeNull();
    expect(ref.current?.getMarkdown() ?? "").not.toContain("alert(1)");
  });

  it("drops a javascript link URL", async () => {
    const { editor, ref, textbox } = renderEditor();

    selectStart(editor);
    await pasteHtml(textbox, '<a href="javascript:alert(1)">bad</a>');

    const markdown = ref.current?.getMarkdown() ?? "";

    expect(markdown).not.toContain("javascript:");
    expect(markdown).toContain("bad");
  });

  it("drops an image with an inline event handler", async () => {
    const { editor, ref, textbox } = renderEditor();

    selectStart(editor);
    await pasteHtml(textbox, '<img src="x" onerror="alert(1)">');

    const markdown = ref.current?.getMarkdown() ?? "";

    expect(document.querySelector("[data-slot='image-node']")).toBeNull();
    expect(markdown).not.toContain("onerror");
    expect(markdown).not.toContain("![");
  });
});
