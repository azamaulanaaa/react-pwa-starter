// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { $getRoot, $isElementNode, type LexicalEditor } from "lexical";
import { describe, expect, it, vi } from "vitest";

import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/editor/markdown-editor.tsx";
import { canonicalize } from "@/lib/markdown/index.ts";

const NOTE = [
  "# Title",
  "",
  "A **bold** note with a [link](https://example.com).",
  "",
  "- one",
  "- two",
].join("\n");

type EditorHost = HTMLElement & { __lexicalEditor?: LexicalEditor };

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
    <MarkdownEditor
      ref={ref}
      ariaLabel={ariaLabel}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      value={value}
    />,
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
    expect(textbox.getAttribute("aria-readonly")).toBe("true");
    expect(ref.current?.getMarkdown()).toBe("# Read only\n");
  });

  it("gives the editable region a name and multiline semantics", () => {
    renderEditor({ value: "# Named\n" });
    const textbox = screen.getByRole("textbox", { name: "Note body" });

    expect(textbox.getAttribute("aria-label")).toBe("Note body");
    expect(textbox.getAttribute("aria-multiline")).toBe("true");
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
      <MarkdownEditor
        ref={ref}
        ariaLabel="Note body"
        onChange={onChange}
        value={"# Second\n"}
      />,
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
});
