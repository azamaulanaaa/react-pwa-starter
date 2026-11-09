// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { $getRoot, $isElementNode, type LexicalEditor } from "lexical";
import { describe, expect, it, vi } from "vitest";

import {
  type NestedRecord,
  TranslationProvider,
} from "@/components/context/translation.tsx";
import type { ImageUploadHandler } from "@/components/editor/image-upload.ts";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownEditorVariant,
} from "@/components/editor/markdown-editor.tsx";
import { recordEditorEvent } from "@/components/editor/editor-telemetry.ts";
import type { MentionSource } from "@/lib/mentions/index.ts";
import { canonicalize } from "@/lib/markdown/index.ts";

import enDictionary from "~/public/locales/en-US.json" with { type: "json" };

// The editor tests do not start a worker. The image node reads the missing state.
vi.mock("@/hooks/engines/use-file-blob.ts", () => ({
  useFileBlob: () => ({ status: "missing", url: null }),
}));

vi.mock("@/components/editor/editor-telemetry.ts", () => ({
  recordEditorEvent: vi.fn(),
}));

// jsdom does not measure a DOM Range. The typeahead plugin reads the range.
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

const FAKE_MENTION_SOURCE: MentionSource = {
  async search() {
    return [
      {
        kind: "user",
        id: "alex-morgan",
        label: "Alice",
        description: "Product manager",
      },
    ];
  },
  async get() {
    return null;
  },
};

const NOTE = [
  "# Title",
  "",
  "A **bold** note with a [link](https://example.com).",
  "",
  "- one",
  "- two",
].join("\n");

const TABLE = [
  "| Name | Value |",
  "| ---- | ----- |",
  "| A    | 1     |",
  "| B    | 2     |",
].join("\n");

const IMAGE = "![Diagram](/fs/file_01)\n";

type EditorHost = HTMLElement & { __lexicalEditor?: LexicalEditor };

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

function renderEditor({
  ariaDescribedBy,
  ariaInvalid,
  ariaLabel = "Note body",
  id,
  mentionSource,
  onChange = vi.fn(),
  onUploadImage,
  placeholder,
  readOnly,
  showToolbar,
  value,
  variant,
}: {
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  ariaLabel?: string;
  id?: string;
  mentionSource?: MentionSource;
  onChange?: (markdown: string) => void;
  onUploadImage?: ImageUploadHandler;
  placeholder?: string;
  readOnly?: boolean;
  showToolbar?: boolean;
  value: string;
  variant?: MarkdownEditorVariant;
}) {
  const ref = createRef<MarkdownEditorHandle>();
  const view = render(
    <Providers>
      <MarkdownEditor
        ref={ref}
        ariaDescribedBy={ariaDescribedBy}
        ariaInvalid={ariaInvalid}
        ariaLabel={ariaLabel}
        id={id}
        mentionSource={mentionSource}
        onChange={onChange}
        onUploadImage={onUploadImage}
        placeholder={placeholder}
        readOnly={readOnly}
        showToolbar={showToolbar}
        value={value}
        variant={variant}
      />
    </Providers>,
  );

  return { ...view, onChange, ref };
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

/** Returns the Lexical editor that owns one contenteditable element. */
function getEditor(element: HTMLElement): LexicalEditor {
  const editor = (element as EditorHost).__lexicalEditor;

  if (editor === undefined) {
    throw new Error("The test did not find the Lexical editor.");
  }

  return editor;
}

describe("MarkdownEditor", () => {
  it("shows Markdown as editable rich text", () => {
    const { ref } = renderEditor({ value: NOTE });
    const textbox = screen.getByRole("textbox", { name: "Note body" });

    expect(textbox.textContent).toContain("Title");
    expect(textbox.textContent).toContain("A bold note with a link.");
    expect(textbox.textContent).toContain("one");
    expect(ref.current?.getMarkdown()).toBe(canonicalize(NOTE));
  });

  it("emits canonical Markdown after a text edit", () => {
    const { onChange, ref } = renderEditor({ value: NOTE });
    const textbox = screen.getByRole("textbox", { name: "Note body" });
    const editor = getEditor(textbox);

    act(() => {
      editor.update(
        () => {
          const first = $getRoot().getFirstChild();

          if (first !== null && $isElementNode(first)) {
            first.selectEnd().insertText("!");
          }
        },
        { discrete: true },
      );
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(ref.current?.getMarkdown()).toContain("Title!");
    expect(onChange).toHaveBeenLastCalledWith(ref.current?.getMarkdown());
  });

  it("returns an empty string for an empty value", () => {
    const { ref } = renderEditor({ value: "" });
    const textbox = screen.getByRole("textbox", { name: "Note body" });

    expect(textbox.textContent).toBe("");
    expect(ref.current?.getMarkdown()).toBe("");
  });

  it("blocks edits when readOnly is true", () => {
    const { ref } = renderEditor({ readOnly: true, value: "# Read only\n" });
    const textbox = screen.getByRole("textbox", { name: "Note body" });

    expect(textbox.getAttribute("contenteditable")).toBe("false");
    expect(textbox.getAttribute("role")).toBe("textbox");
    expect(textbox.getAttribute("aria-multiline")).toBe("true");
    expect(textbox.getAttribute("aria-readonly")).toBe("true");
    expect(ref.current?.getMarkdown()).toBe("# Read only\n");
  });

  it("gives the editable region a name and multiline semantics", () => {
    renderEditor({ value: "# Named\n" });
    const textbox = screen.getByRole("textbox", { name: "Note body" });

    expect(textbox.getAttribute("role")).toBe("textbox");
    expect(textbox.getAttribute("aria-label")).toBe("Note body");
    expect(textbox.getAttribute("aria-multiline")).toBe("true");
    expect(textbox.hasAttribute("aria-readonly")).toBe(false);
    expect(textbox.getAttribute("data-slot")).toBe("markdown-editor");
  });

  it("shows a placeholder that is not the accessible name", () => {
    renderEditor({ placeholder: "# Project notes", value: "" });
    const placeholder = screen.getByText("# Project notes");

    expect(placeholder.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Note body" })).toBeDefined();
  });

  it("replaces the content when the value changes from outside", () => {
    const onChange = vi.fn();
    const { ref, rerender } = renderEditor({ onChange, value: "# First\n" });

    rerender(
      <Providers>
        <MarkdownEditor
          ref={ref}
          ariaLabel="Note body"
          onChange={onChange}
          value={"# Second\n"}
        />
      </Providers>,
    );

    const textbox = screen.getByRole("textbox", { name: "Note body" });

    expect(textbox.textContent).toContain("Second");
    expect(ref.current?.getMarkdown()).toBe("# Second\n");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("replaces the content from the handle without an onChange call", () => {
    const { onChange, ref } = renderEditor({ value: "# Before\n" });

    act(() => {
      ref.current?.setMarkdown("# After\n");
    });

    const textbox = screen.getByRole("textbox", { name: "Note body" });

    expect(textbox.textContent).toContain("After");
    expect(ref.current?.getMarkdown()).toBe("# After\n");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the raw Markdown fallback for a table", () => {
    renderEditor({ value: TABLE });
    const textarea = screen.getByRole("textbox", { name: "Markdown source" });

    expect(textarea.tagName).toBe("TEXTAREA");
    expect((textarea as HTMLTextAreaElement).value).toBe(TABLE);
    expect(document.querySelector("[contenteditable]")).toBeNull();
    expect(screen.getByText(/contains a table/)).toBeDefined();
  });

  it("records one unsupported event for a table document", () => {
    const record = vi.mocked(recordEditorEvent);

    record.mockClear();
    renderEditor({ value: TABLE });

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith("editor.markdown.unsupported", {
      feature: "table",
    });
  });

  it("shows an image node with its alt text", async () => {
    renderEditor({ value: IMAGE, variant: "full" });

    expect(document.querySelector('[data-slot="image-node"]')).not.toBeNull();
    expect(screen.getByText("Diagram")).toBeDefined();
    expect(await screen.findByText("Image unavailable")).toBeDefined();
    expect(
      screen.queryByRole("textbox", { name: "Markdown source" }),
    ).toBeNull();
  });

  it("shows the editor for a supported note", () => {
    renderEditor({ value: NOTE });
    const textbox = screen.getByRole("textbox", { name: "Note body" });

    expect(textbox.getAttribute("contenteditable")).toBe("true");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("associates the fallback label and notice", () => {
    renderEditor({ value: TABLE });
    const textarea = screen.getByLabelText("Markdown source");
    const label =
      textarea.id === ""
        ? null
        : document.querySelector(`label[for="${textarea.id}"]`);
    const describedBy = textarea.getAttribute("aria-describedby");
    const notice =
      describedBy === null ? null : document.getElementById(describedBy);

    expect(textarea.tagName).toBe("TEXTAREA");
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe("Markdown source");
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain("table");
    expect(notice?.textContent).toContain("Edit the Markdown below");
  });

  it("keeps a table as raw Markdown instead of saving paragraphs", () => {
    const onChange = vi.fn();
    renderEditor({ onChange, value: TABLE });
    const textarea = screen.getByRole("textbox", {
      name: "Markdown source",
    }) as HTMLTextAreaElement;
    const edited = TABLE.replace("| A    | 1     |", "| C    | 3     |");

    fireEvent.change(textarea, { target: { value: edited } });

    expect(document.querySelector("[contenteditable]")).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(edited);
    expect(onChange.mock.calls[0]?.[0]).toContain("| C    | 3     |");
  });

  it.each(["plain", "compact"] as const)(
    "hides the block controls for the %s variant",
    (variant) => {
      renderEditor({ value: "Alpha\n", variant });

      expect(screen.queryByRole("combobox", { name: "Block type" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Bullet list" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Numbered list" }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Check list" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Blockquote" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Code block" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Insert horizontal rule" }),
      ).toBeNull();
      expect(screen.getByRole("button", { name: "Bold" })).toBeDefined();
    },
  );

  it("shows the mention picker for the compact variant", async () => {
    const { ref } = renderEditor({
      mentionSource: FAKE_MENTION_SOURCE,
      value: "",
      variant: "compact",
    });
    const editor = getEditor(
      screen.getByRole("textbox", { name: "Note body" }),
    );

    typeText(editor, "Hello @al");

    const option = await screen.findByRole("option", { name: /Alice/ });

    fireEvent.click(option);

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain(
        "[Alice](/users/alex-morgan)",
      );
    });
  });

  it("hides the mention picker for the plain variant", async () => {
    renderEditor({
      mentionSource: FAKE_MENTION_SOURCE,
      value: "",
      variant: "plain",
    });
    const editor = getEditor(
      screen.getByRole("textbox", { name: "Note body" }),
    );

    typeText(editor, "Hello @al");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(screen.queryByRole("option")).toBeNull();
  });

  it("shows the block controls and hides the image button for standard", () => {
    const onUploadImage: ImageUploadHandler = async (file) => ({
      alt: file.name,
      id: "file_01",
    });

    renderEditor({ onUploadImage, value: "Alpha\n", variant: "standard" });

    expect(screen.getByRole("combobox", { name: "Block type" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Bullet list" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Blockquote" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Code block" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Insert image" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Insert horizontal rule" }),
    ).toBeNull();
  });

  it("shows the image button for the full variant with an upload handler", () => {
    const onUploadImage: ImageUploadHandler = async (file) => ({
      alt: file.name,
      id: "file_01",
    });

    renderEditor({ onUploadImage, value: "Alpha\n", variant: "full" });

    const image = screen.getByRole("button", { name: "Insert image" });

    expect((image as HTMLButtonElement).disabled).toBe(false);
    expect(
      screen.getByRole("button", { name: "Insert horizontal rule" }),
    ).toBeDefined();
  });

  it("hides the toolbar when readOnly is true", () => {
    renderEditor({ readOnly: true, value: "Alpha\n", variant: "full" });

    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("updates once when the value changes from outside and does not echo", () => {
    const onChange = vi.fn();
    const { ref, rerender } = renderEditor({
      onChange,
      value: "# First\n",
    });

    rerender(
      <Providers>
        <MarkdownEditor
          ref={ref}
          ariaLabel="Note body"
          onChange={onChange}
          value={"# Second\n"}
        />
      </Providers>,
    );

    rerender(
      <Providers>
        <MarkdownEditor
          ref={ref}
          ariaLabel="Note body"
          onChange={onChange}
          value={"# Second\n"}
        />
      </Providers>,
    );

    expect(
      screen.getByRole("textbox", { name: "Note body" }).textContent,
    ).toContain("Second");
    expect(ref.current?.getMarkdown()).toBe("# Second\n");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sets the id and aria attributes on the editable region", () => {
    renderEditor({
      ariaDescribedBy: "note-help",
      ariaInvalid: true,
      id: "note-body",
      value: "Alpha\n",
    });
    const textbox = screen.getByRole("textbox", { name: "Note body" });

    expect(textbox.id).toBe("note-body");
    expect(textbox.getAttribute("aria-describedby")).toBe("note-help");
    expect(textbox.getAttribute("aria-invalid")).toBe("true");
  });

  it("sets the id and aria attributes on the fallback", () => {
    renderEditor({
      ariaDescribedBy: "note-help",
      ariaInvalid: true,
      id: "note-body",
      value: TABLE,
    });
    const textarea = screen.getByRole("textbox");

    expect(textarea.id).toBe("note-body");
    expect(textarea.getAttribute("aria-describedby")).toContain("note-help");
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
  });
});
