// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IntlProvider } from "@/components/context/intl.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import {
  FormAnnouncement,
  type FormAnnouncementValue,
} from "@/components/form/announcement/index.tsx";

import dictionary from "~/public/locales/en-US.json" with { type: "json" };

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

function renderForm(onSubmit: (value: FormAnnouncementValue) => void) {
  return render(
    <Providers>
      <FormAnnouncement onSubmit={onSubmit} />
    </Providers>,
  );
}

function fillForm(title: string, body: string): void {
  fireEvent.change(
    screen.getByLabelText(dictionary.system_announcements_form_title_label),
    { target: { value: title } },
  );
  fireEvent.change(
    screen.getByLabelText(dictionary.system_announcements_form_body_label),
    { target: { value: body } },
  );
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
  it("submits trimmed values with the default banner presentation", async () => {
    const onSubmit = vi.fn();

    renderForm(onSubmit);

    fillForm("  Maintenance tonight  ", "  Save your work.  ");
    submitForm();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Maintenance tonight",
        body: "Save your work.",
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
        body: "Save your work.",
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
    const bodyInput = screen.getByLabelText(
      dictionary.system_announcements_form_body_label,
    );
    const requiredErrors = await screen.findAllByText(
      dictionary.system_announcements_form_required,
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(requiredErrors).toHaveLength(2);
    expect(titleInput.getAttribute("aria-invalid")).toBe("true");
    expect(bodyInput.getAttribute("aria-invalid")).toBe("true");
  });

  it("resets the title and message after a successful submit", async () => {
    renderForm(() => {});

    fillForm("Maintenance tonight", "Save your work.");
    submitForm();

    const titleInput = screen.getByLabelText(
      dictionary.system_announcements_form_title_label,
    ) as HTMLInputElement;
    const bodyInput = screen.getByLabelText(
      dictionary.system_announcements_form_body_label,
    ) as HTMLTextAreaElement;

    await waitFor(() => {
      expect(titleInput.value).toBe("");
      expect(bodyInput.value).toBe("");
    });
  });
});
