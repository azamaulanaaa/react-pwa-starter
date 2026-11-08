// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IntlProvider } from "@/components/context/intl.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import {
  ImageThumbnail,
  type ImageThumbnailProps,
} from "@/components/image/thumbnail/index.tsx";

import dictionary from "~/public/locales/en-US.json" with { type: "json" };

const IMAGE_SRC =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%221200%22%20height%3D%22800%22%3E%3Crect%20width%3D%221200%22%20height%3D%22800%22%20fill%3D%22%231d4ed8%22%2F%3E%3C%2Fsvg%3E";

function renderThumbnail(props: Partial<ImageThumbnailProps> = {}) {
  return render(
    <TranslationProvider
      dictionary={dictionary}
      fallbackDictionary={dictionary}
    >
      <IntlProvider locale="en-US">
        <ImageThumbnail alt="Report" src={IMAGE_SRC} {...props} />
      </IntlProvider>
    </TranslationProvider>,
  );
}

function getThumbnail(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: "View Report larger",
  }) as HTMLButtonElement;
}

function getDialog(): Element | null {
  return document.querySelector('[data-slot="image-view"]');
}

describe("ImageThumbnail", () => {
  it("shows the image source and the alt text", () => {
    renderThumbnail();

    const image = screen.getByRole("img", { name: "Report" });

    expect(image.getAttribute("src")).toBe(IMAGE_SRC);
    expect(image.getAttribute("alt")).toBe("Report");
  });

  it("names the button with the image alt text", () => {
    renderThumbnail();

    expect(getThumbnail().getAttribute("aria-label")).toBe(
      "View Report larger",
    );
  });

  it("shows the overlay and the eye badge", () => {
    renderThumbnail();

    const overlay = document.querySelector(
      '[data-slot="image-thumbnail-overlay"]',
    );
    const eye = document.querySelector('[data-slot="image-thumbnail-eye"]');

    expect(overlay).not.toBeNull();
    expect(eye).not.toBeNull();
    expect(overlay!.classList.contains("opacity-0")).toBe(true);
    expect(overlay!.classList.contains("group-hover:opacity-100")).toBe(true);
  });

  it("opens the lightbox on a click", () => {
    renderThumbnail();

    fireEvent.click(getThumbnail());

    expect(getDialog()).not.toBeNull();
  });

  it("stays closed in the controlled state and reports the change", () => {
    const onOpenChange = vi.fn();
    renderThumbnail({ onOpenChange, open: false });

    fireEvent.click(getThumbnail());

    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(getDialog()).toBeNull();
    expect(getThumbnail().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the lightbox from the close button", () => {
    renderThumbnail();

    fireEvent.click(getThumbnail());

    fireEvent.click(screen.getByRole("button", { name: "Close image" }));

    expect(getDialog()).toBeNull();
  });

  it("hides the lightbox before a click", () => {
    renderThumbnail();

    expect(getDialog()).toBeNull();
  });

  it("uses the custom download name for the download link", () => {
    renderThumbnail({ downloadName: "report.png" });

    fireEvent.click(getThumbnail());

    const download = screen.getByRole("link", { name: "Download" });

    expect(download.getAttribute("download")).toBe("report.png");
  });

  it("adds the custom class to the root", () => {
    renderThumbnail({ className: "max-w-xl" });

    const root = document.querySelector('[data-slot="image-thumbnail"]');

    expect(root!.classList.contains("max-w-xl")).toBe(true);
  });

  it("hides the eye badge from assistive technology", () => {
    renderThumbnail();

    const eye = document.querySelector('[data-slot="image-thumbnail-eye"]');

    expect(eye!.getAttribute("aria-hidden")).toBe("true");
  });
});
