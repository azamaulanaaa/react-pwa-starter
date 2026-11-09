// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
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
import { canonicalize } from "@/lib/markdown/index.ts";

import enDictionary from "~/public/locales/en-US.json" with { type: "json" };

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
  ariaLabel = "Note body",
  onChange = vi.fn(),
  placeholder,
  readOnly,
  value,
}: {
  ariaLabel?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  value: string;
}) {
  const ref = createRef<MarkdownEditorHandle>();
  const view = render(
    <Providers>
      <MarkdownEditor
        ref={ref}
        ariaLabel={ariaLabel}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
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

  it("shows the raw Markdown fallback for an image", () => {
    renderEditor({ value: IMAGE });
    const textarea = screen.getByRole("textbox", { name: "Markdown source" });

    expect(textarea.tagName).toBe("TEXTAREA");
    expect((textarea as HTMLTextAreaElement).value).toBe(IMAGE);
    expect(document.querySelector("[contenteditable]")).toBeNull();
    expect(screen.getByText(/contains an image/)).toBeDefined();
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
});
