// @vitest-environment jsdom
import type { ReactNode } from "react";
import {
  $convertFromMarkdownString,
  type Transformer,
} from "@lexical/markdown";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { $getRoot, type LexicalEditor } from "lexical";
import { describe, expect, it, vi } from "vitest";

import { IntlProvider } from "@/components/context/intl.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import {
  FormAnnouncement,
  type FormAnnouncementProps,
  type FormAnnouncementValue,
} from "@/components/form/announcement/index.tsx";
import type { ImageUploadHandler } from "@/components/editor/image-upload.ts";
import { recordEditorEvent } from "@/components/editor/editor-telemetry.ts";
import { getTransformers } from "@/components/editor/transformers.ts";

import dictionary from "~/public/locales/en-US.json" with { type: "json" };

// The form tests do not start a worker. The image node reads the missing state.
vi.mock("@/hooks/engines/use-file-blob.ts", () => ({
  useFileBlob: () => ({ status: "missing", url: null }),
}));

vi.mock("@/components/editor/editor-telemetry.ts", () => ({
  recordEditorEvent: vi.fn(),
}));

const BODY_LABEL = dictionary.system_announcements_form_body_label;
const STANDARD_TRANSFORMERS: Transformer[] = getTransformers("standard");

type EditorHost = HTMLElement & { __lexicalEditor?: LexicalEditor };

function Providers({ children }: { children: ReactNode }) {
  return (
    <TranslationProvider
      dictionary={dictionary}
      fallbackDictionary={dictionary}
    >
      <IntlProvider locale="en-US">{children}</IntlProvider>
    </TranslationProvider>
  );
}

function renderForm(
  onSubmit: (value: FormAnnouncementValue) => void,
  props: Omit<FormAnnouncementProps, "onSubmit"> = {},
) {
  return render(
    <Providers>
      <FormAnnouncement onSubmit={onSubmit} {...props} />
    </Providers>,
  );
}

function getBodyEditor(): HTMLElement {
  return screen.getByRole("textbox", { name: BODY_LABEL });
}

function getEditor(element: HTMLElement): LexicalEditor {
  const editor = (element as EditorHost).__lexicalEditor;

  if (editor === undefined) {
    throw new Error("The test did not find the Lexical editor.");
  }

  return editor;
}

function typeTitle(title: string): void {
  fireEvent.change(
    screen.getByLabelText(dictionary.system_announcements_form_title_label),
    { target: { value: title } },
  );
}

function typeBody(markdown: string): void {
  const editor = getEditor(getBodyEditor());

  act(() => {
    editor.update(
      () => {
        $getRoot().clear();
        $convertFromMarkdownString(markdown, STANDARD_TRANSFORMERS);
      },
      { discrete: true },
    );
  });
}

function fillForm(title: string, body: string): void {
  typeTitle(title);
  typeBody(body);
}

function submitForm(): void {
  fireEvent.click(
    screen.getByRole("button", {
      name: dictionary.system_announcements_form_submit,
    }),
  );
}

function choosePresentation(label: string): void {
  fireEvent.click(
    screen.getByLabelText(
      dictionary.system_announcements_form_presentation_label,
    ),
  );

  const option = screen.getByRole("option", { name: label });

  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
}

describe("FormAnnouncement", () => {
  it("renders the Markdown editor instead of a plain textarea", () => {
    renderForm(() => {});

    const editor = getBodyEditor();

    expect(editor.getAttribute("contenteditable")).toBe("true");
    expect(editor.tagName).not.toBe("TEXTAREA");
    expect(editor.closest(".markdown-editor-shell")).not.toBeNull();
  });

  it("associates the visible label with the editor", () => {
    renderForm(() => {});

    const label = screen.getByText(BODY_LABEL);
    const editor = getBodyEditor();

    expect(label.tagName).toBe("LABEL");
    expect(label.getAttribute("for")).toBe(editor.id);
    expect(editor.getAttribute("aria-label")).toBe(BODY_LABEL);
  });

  it("submits trimmed values with the default banner presentation", async () => {
    const onSubmit = vi.fn();

    renderForm(onSubmit);

    fillForm("  Maintenance tonight  ", "  Save your work.  ");
    submitForm();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Maintenance tonight",
        body: "Save your work.\n",
        variant: "info",
        preferredPresentation: "banner",
      });
    });
  });

  it("submits the lightbox presentation from the select", async () => {
    const onSubmit = vi.fn();

    renderForm(onSubmit);

    fillForm("Maintenance tonight", "Save your work.");
    choosePresentation(dictionary.system_announcement_presentation_dialog);
    submitForm();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Maintenance tonight",
        body: "Save your work.\n",
        variant: "info",
        preferredPresentation: "dialog",
      });
    });
  });

  it("shows both required errors and does not submit empty fields", async () => {
    const onSubmit = vi.fn();

    renderForm(onSubmit);

    submitForm();

    const titleInput = screen.getByLabelText(
      dictionary.system_announcements_form_title_label,
    );
    const bodyInput = getBodyEditor();
    const requiredErrors = await screen.findAllByText(
      dictionary.system_announcements_form_required,
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(requiredErrors).toHaveLength(2);
    expect(titleInput.getAttribute("aria-invalid")).toBe("true");
    expect(bodyInput.getAttribute("aria-invalid")).toBe("true");
  });

  it("rejects an empty body and focuses the editor", async () => {
    const onSubmit = vi.fn();

    renderForm(onSubmit);

    typeTitle("Maintenance tonight");
    submitForm();

    const bodyInput = getBodyEditor();

    expect(
      await screen.findByText(dictionary.system_announcements_form_required),
    ).toBeTruthy();
    expect(bodyInput.getAttribute("aria-invalid")).toBe("true");
    expect(onSubmit).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(document.activeElement).toBe(bodyInput);
    });
  });

  it("submits canonical Markdown on submit", async () => {
    const onSubmit = vi.fn();

    renderForm(onSubmit);

    fillForm(
      "Maintenance tonight",
      "Release notes\n=============\n\n* first\n* second\n",
    );
    submitForm();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Maintenance tonight",
        body: "# Release notes\n\n- first\n- second\n",
        variant: "info",
        preferredPresentation: "banner",
      });
    });
  });

  it("keeps a mention link unchanged", async () => {
    const onSubmit = vi.fn();

    renderForm(onSubmit);

    fillForm("Maintenance tonight", "[Alice](/users/123)\n");
    submitForm();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ body: "[Alice](/users/123)\n" }),
      );
    });
  });

  it("rejects raw HTML with the Markdown message and focuses the fallback", async () => {
    const onSubmit = vi.fn();
    const body = "<b>Alert</b>";

    renderForm(onSubmit, {
      defaultValues: {
        title: "Maintenance tonight",
        body,
        variant: "info",
        preferredPresentation: "banner",
      },
    });

    submitForm();

    const messageInput = screen.getByLabelText(BODY_LABEL);
    const error = await screen.findByText(
      dictionary.system_announcements_form_markdown_invalid,
    );
    const describedBy = messageInput.getAttribute("aria-describedby");
    const describedText = (describedBy ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");

    expect(messageInput.tagName).toBe("TEXTAREA");
    expect(messageInput.getAttribute("aria-invalid")).toBe("true");
    expect(describedBy).toBeTruthy();
    expect(describedText).toContain(
      dictionary.system_announcements_form_markdown_invalid,
    );
    expect(error).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(document.activeElement).toBe(messageInput);
    });
  });

  it("removes a javascript link from the editor body", async () => {
    const onSubmit = vi.fn();

    renderForm(onSubmit);

    fillForm("Maintenance tonight", "[Open](javascript:alert(1))");
    submitForm();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ body: "Open\n" }),
      );
    });

    const submittedBody = onSubmit.mock.calls[0]?.[0]?.body ?? "";

    expect(submittedBody).not.toContain("javascript:");
  });

  it("records one invalid Markdown event for the raw fallback", async () => {
    const record = vi.mocked(recordEditorEvent);
    const onSubmit = vi.fn();
    const body = "| Link |\n| --- |\n| [Open](javascript:alert(1)) |";

    record.mockClear();
    renderForm(onSubmit, {
      defaultValues: {
        title: "Maintenance tonight",
        body,
        variant: "info",
        preferredPresentation: "banner",
      },
    });

    submitForm();

    await screen.findByText(
      dictionary.system_announcements_form_markdown_invalid,
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith("editor.markdown.invalid", {
      code: "link_not_allowed",
    });
  });

  it("inserts an uploaded image into the Markdown", async () => {
    const onSubmit = vi.fn();
    const onUploadImage: ImageUploadHandler = vi.fn(async (file) => ({
      alt: file.name,
      id: "file_1",
    }));

    renderForm(onSubmit, { onUploadImage });
    typeTitle("Maintenance tonight");

    fireEvent.click(
      screen.getByRole("button", { name: dictionary.editor_image_button }),
    );

    const file = new File(["image"], "photo.png", { type: "image/png" });

    fireEvent.change(
      screen.getByLabelText(dictionary.editor_image_file_label),
      { target: { files: [file] } },
    );

    await waitFor(() => {
      expect(getBodyEditor().textContent).toContain("photo.png");
    });

    submitForm();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ body: "![photo.png](/fs/file_1)\n" }),
      );
    });
  });

  it("does not loop when the editor sends the same Markdown back", async () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();

    renderForm(onSubmit, { onChange });
    typeBody("Save your work.");

    expect(onChange).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("resets the title and editor after a successful submit", async () => {
    renderForm(() => {});

    fillForm("Maintenance tonight", "Save your work.");
    submitForm();

    const titleInput = screen.getByLabelText(
      dictionary.system_announcements_form_title_label,
    ) as HTMLInputElement;

    await waitFor(() => {
      expect(titleInput.value).toBe("");
      expect(getBodyEditor().textContent).toBe("");
    });
  });
});
