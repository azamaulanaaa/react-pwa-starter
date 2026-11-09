// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { $getRoot, $isElementNode, type LexicalEditor } from "lexical";
import { describe, expect, it, vi } from "vitest";

import {
  type NestedRecord,
  TranslationProvider,
} from "@/components/context/translation.tsx";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/editor/markdown-editor.tsx";
import { recordEditorEvent } from "@/components/editor/editor-telemetry.ts";
import type { MentionSource, MentionTarget } from "@/lib/mentions/index.ts";

import enDictionary from "~/public/locales/en-US.json" with { type: "json" };

// The mention tests do not start a worker. The image node reads the missing state.
vi.mock("@/hooks/engines/use-file-blob.ts", () => ({
  useFileBlob: () => ({ status: "missing", url: null }),
}));

vi.mock("@/components/editor/editor-telemetry.ts", () => ({
  recordEditorEvent: vi.fn(),
}));

// jsdom does not measure a DOM Range. The typeahead plugin asks for the range
// rectangle to position the menu, so the test supplies a zero-size rectangle.
if (typeof Range !== "undefined") {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}

// jsdom has no scrollIntoView. The menu scrolls the active option into view.
if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom has no ResizeObserver. The typeahead plugin watches the menu anchor.
if (typeof ResizeObserver === "undefined") {
  class TestResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver =
    TestResizeObserver as unknown as typeof ResizeObserver;
}

const USER_TARGET: MentionTarget = {
  kind: "user",
  id: "alex-morgan",
  label: "Alice",
  description: "Product manager",
};

const PAGE_TARGET: MentionTarget = {
  kind: "page",
  id: "product-roadmap",
  label: "Product Roadmap",
  description: "Plans for the next two quarters",
};

const TARGETS = [USER_TARGET, PAGE_TARGET];

type EditorHost = HTMLElement & { __lexicalEditor?: LexicalEditor };

/** Returns a search source over one fixed target list. */
function createFakeSource(targets: MentionTarget[]): MentionSource {
  return {
    async search(query, signal) {
      if (signal?.aborted) {
        throw new DOMException("The mention search stopped.", "AbortError");
      }

      const normalized = query.trim().toLowerCase();

      return targets.filter((target) =>
        target.label.toLowerCase().includes(normalized),
      );
    },

    async get(target) {
      return (
        targets.find(
          (item) => item.kind === target.kind && item.id === target.id,
        ) ?? null
      );
    },
  };
}

/** Returns a source that rejects each search. */
function createErrorSource(): MentionSource {
  return {
    async search() {
      throw new Error("The test source failed.");
    },

    async get() {
      return null;
    },
  };
}

const FAKE_SOURCE = createFakeSource(TARGETS);

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

/** Renders the editor with a mention source. */
function renderMentionEditor({
  mentionSource = FAKE_SOURCE,
  value = "",
}: {
  mentionSource?: MentionSource;
  value?: string;
} = {}) {
  const ref = createRef<MarkdownEditorHandle>();
  const onChange = vi.fn();
  const view = render(
    <Providers>
      <MarkdownEditor
        ref={ref}
        ariaLabel="Note body"
        mentionSource={mentionSource}
        onChange={onChange}
        value={value}
      />
    </Providers>,
  );

  return { ...view, onChange, ref };
}

/** Returns the Lexical editor that owns one contenteditable element. */
function getEditor(element: HTMLElement): LexicalEditor {
  const editor = (element as EditorHost).__lexicalEditor;

  if (editor === undefined) {
    throw new Error("The test did not find the Lexical editor.");
  }

  return editor;
}

/** Inserts text at the end of the current editor content. */
function typeText(editor: LexicalEditor, text: string): void {
  act(() => {
    editor.update(
      () => {
        const last = $getRoot().getLastChild();

        if (last !== null && $isElementNode(last)) {
          last.selectEnd().insertText(text);
        }
      },
      { discrete: true },
    );
  });
}

/** Renders the editor and returns it with the editable element. */
function renderReadyEditor(options?: {
  mentionSource?: MentionSource;
  value?: string;
}) {
  const view = renderMentionEditor(options);
  const textbox = screen.getByRole("textbox", { name: "Note body" });

  return { ...view, editor: getEditor(textbox), textbox };
}

describe("MentionTypeaheadPlugin", () => {
  it("inserts a user mention as a Markdown link", async () => {
    const { ref, editor } = renderReadyEditor();

    typeText(editor, "Hello @al");

    const option = await screen.findByRole("option", { name: /Alice/ });

    fireEvent.mouseDown(option);
    fireEvent.click(option);

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain(
        "Hello [Alice](/users/alex-morgan)",
      );
    });

    const link = screen.getByRole("link", { name: "Alice" });

    expect(link.getAttribute("href")).toBe("/users/alex-morgan");
  });

  it("inserts a page mention as a Markdown link", async () => {
    const { ref, editor } = renderReadyEditor();

    typeText(editor, "See @road");

    const option = await screen.findByRole("option", {
      name: /Product Roadmap/,
    });

    fireEvent.click(option);

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain(
        "[Product Roadmap](/pages/product-roadmap)",
      );
    });

    const link = screen.getByRole("link", { name: "Product Roadmap" });

    expect(link.getAttribute("href")).toBe("/pages/product-roadmap");
  });

  it("closes the menu on Escape", async () => {
    const { editor, textbox } = renderReadyEditor();

    typeText(editor, "Hello @al");

    await screen.findByRole("option", { name: /Alice/ });

    fireEvent.keyDown(textbox, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("option")).toBeNull();
    });
  });

  it("selects an option with ArrowDown and Enter", async () => {
    const { ref, editor, textbox } = renderReadyEditor();

    typeText(editor, "Hello @");

    const first = await screen.findByRole("option", { name: /Alice/ });

    expect(first.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(textbox, { key: "ArrowDown" });

    const page = await screen.findByRole("option", {
      name: /Product Roadmap/,
    });

    expect(page.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(textbox, { key: "Enter" });

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain(
        "[Product Roadmap](/pages/product-roadmap)",
      );
    });
  });

  it("shows the empty state for a query with no matches", async () => {
    const { editor } = renderReadyEditor();

    typeText(editor, "Hello @zzz");

    expect(
      await screen.findByText("No users or pages match this search."),
    ).toBeDefined();
  });

  it("shows the error state when the search fails", async () => {
    const { editor } = renderReadyEditor({
      mentionSource: createErrorSource(),
    });

    typeText(editor, "Hello @al");

    const message = await screen.findByText(
      "Unable to load mentions. Type again to retry.",
    );

    expect(message.getAttribute("role")).toBe("status");
  });

  it("records one mention search failure", async () => {
    const record = vi.mocked(recordEditorEvent);
    const { editor } = renderReadyEditor({
      mentionSource: createErrorSource(),
    });

    record.mockClear();
    typeText(editor, "Hello @al");

    await screen.findByText("Unable to load mentions. Type again to retry.");

    expect(record).toHaveBeenCalledWith("editor.mention.search_failed", {
      reason: "search",
    });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("exposes the menu as a named listbox with options", async () => {
    const { editor } = renderReadyEditor();

    typeText(editor, "Hello @al");

    const listbox = await screen.findByRole("listbox", {
      name: "Mention suggestions",
    });
    const option = within(listbox).getByRole("option", { name: /Alice/ });

    expect(screen.getAllByRole("listbox")).toHaveLength(1);
    expect(option.getAttribute("aria-selected")).not.toBeNull();
  });

  it("round-trips the inserted link through getMarkdown", async () => {
    const { ref, editor } = renderReadyEditor();

    typeText(editor, "Hello @al");

    const option = await screen.findByRole("option", { name: /Alice/ });

    fireEvent.click(option);

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain(
        "[Alice](/users/alex-morgan)",
      );
    });

    const markdown = ref.current?.getMarkdown() ?? "";

    expect(markdown).toMatch(/\[Alice\]\(\/users\/alex-morgan\)/);
    expect(markdown).not.toContain('"type"');
  });
});
