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
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownEditorVariant,
} from "@/components/editor/markdown-editor.tsx";

import enDictionary from "~/public/locales/en-US.json" with { type: "json" };

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

/** Shows one editor with the standard toolbar. */
function renderEditor(
  value: string,
  {
    readOnly,
    showToolbar,
    variant,
  }: {
    readOnly?: boolean;
    showToolbar?: boolean;
    variant?: MarkdownEditorVariant;
  } = {},
) {
  const ref = createRef<MarkdownEditorHandle>();
  const onChange = vi.fn();
  const view = render(
    <Providers>
      <MarkdownEditor
        ref={ref}
        ariaLabel="Note body"
        onChange={onChange}
        readOnly={readOnly}
        showToolbar={showToolbar}
        value={value}
        variant={variant}
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

/** Selects a text range in the first block of one editor. */
function selectFirstBlock(
  editor: LexicalEditor,
  start: number,
  end: number,
): void {
  act(() => {
    editor.update(
      () => {
        const first = $getRoot().getFirstChild();

        if (first !== null && $isElementNode(first)) {
          first.select(start, end);
        }
      },
      { discrete: true },
    );
  });
}

/** Opens the link popover for one editor. */
function openLinkPopover(): HTMLInputElement {
  fireEvent.click(screen.getByRole("button", { name: "Add link" }));

  return screen.getByLabelText("Link address") as HTMLInputElement;
}

describe("EditorToolbar", () => {
  it("gives the toolbar a role and an accessible name", () => {
    renderEditor("Alpha\n");

    expect(
      screen.getByRole("toolbar", { name: "Text formatting" }),
    ).toBeDefined();
  });

  it("hides the toolbar for the plain variant", () => {
    renderEditor("Alpha\n", { variant: "plain" });

    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("hides the toolbar when readOnly is true", () => {
    renderEditor("Alpha\n", { readOnly: true });

    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("hides the toolbar for the unsupported-content fallback", () => {
    renderEditor("| A | B |\n| - | - |\n| 1 | 2 |\n");

    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("toggles bold text in the Markdown output", () => {
    const { ref } = renderEditor("Alpha\n");
    const editor = getEditor(
      screen.getByRole("textbox", { name: "Note body" }),
    );

    selectFirstBlock(editor, 0, 5);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(ref.current?.getMarkdown()).toBe("**Alpha**\n");

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(ref.current?.getMarkdown()).toBe("Alpha\n");
  });

  it("converts a paragraph to a heading from the block select", async () => {
    const { ref } = renderEditor("Alpha\n");
    const editor = getEditor(
      screen.getByRole("textbox", { name: "Note body" }),
    );

    selectFirstBlock(editor, 0, 0);
    fireEvent.click(screen.getByRole("combobox", { name: "Block type" }));

    const heading = await screen.findByRole("option", { name: "Heading 1" });

    fireEvent.pointerDown(heading, { pointerType: "mouse" });
    fireEvent.click(heading);

    expect(ref.current?.getMarkdown()).toBe("# Alpha\n");
  });

  it("inserts a bullet list", () => {
    const { ref } = renderEditor("Alpha\n");
    const editor = getEditor(
      screen.getByRole("textbox", { name: "Note body" }),
    );

    selectFirstBlock(editor, 0, 5);
    fireEvent.click(screen.getByRole("button", { name: "Bullet list" }));

    expect(ref.current?.getMarkdown()).toBe("- Alpha\n");
  });

  it("inserts a horizontal rule", () => {
    const { ref } = renderEditor("Alpha\n");
    const editor = getEditor(
      screen.getByRole("textbox", { name: "Note body" }),
    );

    selectFirstBlock(editor, 0, 5);
    fireEvent.click(
      screen.getByRole("button", { name: "Insert horizontal rule" }),
    );

    expect(ref.current?.getMarkdown()).toContain("---");
  });

  it("applies a link from the popover", () => {
    const { ref } = renderEditor("Example\n");
    const editor = getEditor(
      screen.getByRole("textbox", { name: "Note body" }),
    );

    selectFirstBlock(editor, 0, 7);

    const input = openLinkPopover();

    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply link" }));

    expect(ref.current?.getMarkdown()).toBe("[Example](https://example.com)\n");
  });

  it("rejects a javascript URL and shows the error", () => {
    const { ref } = renderEditor("Example\n");
    const editor = getEditor(
      screen.getByRole("textbox", { name: "Note body" }),
    );

    selectFirstBlock(editor, 0, 7);

    const input = openLinkPopover();

    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply link" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Enter an https:// or mailto: link",
    );
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(ref.current?.getMarkdown()).toBe("Example\n");
  });

  it("disables undo and redo until the history can run", async () => {
    const { ref } = renderEditor("Alpha\n");
    const editor = getEditor(
      screen.getByRole("textbox", { name: "Note body" }),
    );
    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });

    expect((undo as HTMLButtonElement).disabled).toBe(true);
    expect((redo as HTMLButtonElement).disabled).toBe(true);

    selectFirstBlock(editor, 0, 5);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(ref.current?.getMarkdown()).toBe("**Alpha**\n");

    await waitFor(() => {
      expect((undo as HTMLButtonElement).disabled).toBe(false);
    });

    expect((redo as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(undo);

    await waitFor(() => {
      expect((redo as HTMLButtonElement).disabled).toBe(false);
    });

    expect(ref.current?.getMarkdown()).toBe("Alpha\n");
  });

  it("moves focus with the arrow keys, Home, and End", () => {
    renderEditor("Alpha\n");
    const bold = screen.getByRole("button", { name: "Bold" });
    const italic = screen.getByRole("button", { name: "Italic" });
    const horizontalRule = screen.getByRole("button", {
      name: "Insert horizontal rule",
    });

    bold.focus();
    fireEvent.keyDown(bold, { key: "ArrowRight" });
    expect(document.activeElement).toBe(italic);

    fireEvent.keyDown(italic, { key: "Home" });
    expect(document.activeElement).toBe(bold);

    fireEvent.keyDown(bold, { key: "End" });
    expect(document.activeElement).toBe(horizontalRule);
  });
});
