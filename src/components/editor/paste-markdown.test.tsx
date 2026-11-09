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
  type MarkdownEditorVariant,
} from "@/components/editor/markdown-editor.tsx";
import {
  convertMarkdownToSerializedNodes,
  hasMarkdownSyntax,
} from "@/components/editor/paste-markdown-plugin.tsx";
import { STANDARD_TRANSFORMERS } from "@/components/editor/transformers.ts";

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
function renderEditor({
  onChange = vi.fn(),
  value = "",
  variant,
}: {
  onChange?: (markdown: string) => void;
  value?: string;
  variant?: MarkdownEditorVariant;
} = {}) {
  const ref = createRef<MarkdownEditorHandle>();

  render(
    <Providers>
      <MarkdownEditor
        ref={ref}
        ariaLabel="Note body"
        onChange={onChange}
        value={value}
        variant={variant}
      />
    </Providers>,
  );

  const textbox = screen.getByRole("textbox", { name: "Note body" });
  const editor = (textbox as HTMLElement & { __lexicalEditor: LexicalEditor })
    .__lexicalEditor;

  return { editor, onChange, ref, textbox };
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

/** Sends one paste event and waits for the editor update to settle. */
async function paste(
  textbox: HTMLElement,
  parts: Record<string, string>,
): Promise<void> {
  fireEvent.paste(textbox, { clipboardData: createClipboardData(parts) });

  await act(async () => {
    await Promise.resolve();
  });
}

describe("Markdown paste", () => {
  it("parses strong text from the clipboard", async () => {
    const { editor, ref, textbox } = renderEditor();

    selectStart(editor);
    await paste(textbox, { "text/plain": "A **bold** note" });

    expect(ref.current?.getMarkdown()).toContain("**bold**");
  });

  it("parses a heading and a list from the clipboard", async () => {
    const { editor, ref, textbox } = renderEditor();

    selectStart(editor);
    await paste(textbox, { "text/plain": "# Heading\n\n- one\n- two" });

    const markdown = ref.current?.getMarkdown() ?? "";

    expect(markdown).toContain("# Heading");
    expect(markdown).toContain("- one");
    expect(markdown).toContain("- two");
  });

  it("keeps a link from the clipboard", async () => {
    const { editor, ref, textbox } = renderEditor();

    selectStart(editor);
    await paste(textbox, { "text/plain": "[Alice](/users/123)" });

    expect(ref.current?.getMarkdown()).toContain("[Alice](/users/123)");
  });

  it("keeps an image from the clipboard", async () => {
    const { editor, ref, textbox } = renderEditor({ variant: "full" });

    selectStart(editor);
    await paste(textbox, { "text/plain": "![Diagram](/fs/file_01)" });

    expect(ref.current?.getMarkdown()).toContain("![Diagram](/fs/file_01)");
  });

  it("keeps plain prose as plain text", async () => {
    const { editor, ref, textbox } = renderEditor();

    selectStart(editor);
    await paste(textbox, { "text/plain": "hello world" });

    expect(hasMarkdownSyntax("hello world")).toBe(false);
    expect(ref.current?.getMarkdown()).toBe("hello world\n");
  });

  it("does not take over a paste with HTML data", async () => {
    const { editor, ref, textbox } = renderEditor();

    selectStart(editor);
    await paste(textbox, {
      "text/html": "<p>plain</p>",
      "text/plain": "# Heading",
    });

    const markdown = ref.current?.getMarkdown() ?? "";

    expect(markdown).toContain("plain");
    expect(markdown).not.toContain("# Heading");
  });

  it("removes a javascript link from the clipboard", async () => {
    const { editor, ref, textbox } = renderEditor();

    selectStart(editor);
    await paste(textbox, { "text/plain": "[bad](javascript:alert(1))" });

    const markdown = ref.current?.getMarkdown() ?? "";

    expect(markdown).not.toContain("javascript:");
    expect(markdown).toContain("bad");
  });

  it("keeps the focus on the editor after a paste", async () => {
    const { editor, textbox } = renderEditor();

    act(() => {
      textbox.focus();
    });
    selectStart(editor);
    await paste(textbox, { "text/plain": "A **bold** note" });

    expect(document.activeElement).toBe(textbox);
  });

  it("keeps the current document around the paste", async () => {
    const { editor, ref, textbox } = renderEditor({ value: "Alpha\n" });

    act(() => {
      editor.update(
        () => {
          const first = $getRoot().getFirstChild();

          if (first !== null && $isElementNode(first)) {
            first.selectEnd();
          }
        },
        { discrete: true },
      );
    });
    await paste(textbox, { "text/plain": "A **bold** note" });

    const markdown = ref.current?.getMarkdown() ?? "";

    expect(markdown).toContain("Alpha");
    expect(markdown).toContain("**bold**");
  });

  it("converts Markdown to serialized nodes", () => {
    const nodes = convertMarkdownToSerializedNodes(
      "A **bold** note",
      STANDARD_TRANSFORMERS,
    );
    const serialized = JSON.stringify(nodes);

    expect(nodes[0]?.type).toBe("paragraph");
    expect(serialized).toContain('"text":"bold"');
    expect(serialized).toContain('"format":1');
  });

  it.each([
    ["# Heading", true],
    ["- one", true],
    ["> quote", true],
    ["```\ncode\n```", true],
    ["[Alice](/users/123)", true],
    ["![Diagram](/fs/file_01)", true],
    ["A **bold** note", true],
    ["hello world", false],
    ["2 * 3 = 6", false],
  ])("detects Markdown syntax in %s", (text, expected) => {
    expect(hasMarkdownSyntax(text)).toBe(expected);
  });
});
