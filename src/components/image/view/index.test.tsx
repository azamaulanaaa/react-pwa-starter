// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IntlProvider } from "@/components/context/intl.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import {
  ImageView,
  type ImageViewProps,
} from "@/components/image/view/index.tsx";

import dictionary from "~/public/locales/en-US.json" with { type: "json" };

const IMAGE_SRC =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%221200%22%20height%3D%22800%22%3E%3Crect%20width%3D%221200%22%20height%3D%22800%22%20fill%3D%22%231d4ed8%22%2F%3E%3C%2Fsvg%3E";

function renderView(props: Partial<ImageViewProps> = {}) {
  return render(
    <TranslationProvider
      dictionary={dictionary}
      fallbackDictionary={dictionary}
    >
      <IntlProvider locale="en-US">
        <ImageView
          alt="Report"
          onOpenChange={() => {}}
          open
          src={IMAGE_SRC}
          {...props}
        />
      </IntlProvider>
    </TranslationProvider>,
  );
}

function getButton(name: string): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function getLink(name: string): HTMLAnchorElement {
  return screen.getByRole("link", { name }) as HTMLAnchorElement;
}

describe("ImageView", () => {
  it("shows the image and the alt text", () => {
    renderView();

    const image = screen.getByRole("img", { name: "Report" });

    expect(image.getAttribute("src")).toBe(IMAGE_SRC);
    expect(image.getAttribute("alt")).toBe("Report");
  });

  it("closes the dialog from the close button", () => {
    const onOpenChange = vi.fn();
    renderView({ onOpenChange });

    fireEvent.click(getButton("Close image"));

    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it("shows the ghost close button at the top right", () => {
    renderView();

    const close = getButton("Close image");

    expect(close.classList.contains("bg-primary")).toBe(false);
    expect(close.classList.contains("fixed")).toBe(true);
    expect(close.classList.contains("top-4")).toBe(true);
    expect(close.classList.contains("end-4")).toBe(true);
  });

  it("downloads the image from the download link", () => {
    renderView();

    const download = getLink("Download");

    expect(download.getAttribute("href")).toBe(IMAGE_SRC);
    expect(download.getAttribute("download")).toBe("image");
  });

  it("uses the custom download file name", () => {
    renderView({ downloadName: "report.png" });

    expect(getLink("Download").getAttribute("download")).toBe("report.png");
  });

  it("shows the outline download button at the bottom center", () => {
    renderView();

    const download = getLink("Download");

    expect(download.classList.contains("border-input")).toBe(true);
    expect(download.classList.contains("fixed")).toBe(true);
    expect(download.classList.contains("bottom-6")).toBe(true);
  });

  it("shows the zoom controls without a border or shadow", () => {
    renderView();

    const controls = document.querySelector(
      '[data-slot="image-view-zoom-controls"]',
    );

    expect(controls).not.toBeNull();

    const classes = [...controls!.classList];

    expect(classes).not.toContain("shadow-sm");
    expect(classes).not.toContain("border");
    expect(classes.filter((name) => /^border-(?!0$)/.test(name))).toEqual([]);
  });

  it("raises the zoom from 100% to 125%", () => {
    renderView();

    expect(screen.getByText("100%")).toBeDefined();

    fireEvent.click(getButton("Zoom in"));

    expect(screen.getByText("125%")).toBeDefined();
  });

  it("stops the zoom in action at the maximum", () => {
    renderView();

    const zoomIn = getButton("Zoom in");

    for (let step = 0; step < 6; step += 1) {
      fireEvent.click(zoomIn);
    }

    expect(screen.getByText("200%")).toBeDefined();
    expect(zoomIn.disabled).toBe(true);
  });

  it("stops the zoom out action at 100%", () => {
    renderView();

    fireEvent.click(getButton("Zoom in"));

    const zoomOut = getButton("Zoom out");

    fireEvent.click(zoomOut);
    fireEvent.click(zoomOut);

    expect(screen.getByText("100%")).toBeDefined();
    expect(zoomOut.disabled).toBe(true);
  });

  it("returns the zoom to 100% from the reset button", () => {
    renderView();

    fireEvent.click(getButton("Zoom in"));

    const reset = getButton("Reset zoom");

    fireEvent.click(reset);

    expect(screen.getByText("100%")).toBeDefined();
    expect(reset.disabled).toBe(true);
  });

  it("stops the zoom in action at the custom maximum", () => {
    renderView({ maxZoom: 1.5 });

    const zoomIn = getButton("Zoom in");

    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);

    expect(screen.getByText("150%")).toBeDefined();
    expect(zoomIn.disabled).toBe(true);
  });

  it("hides the image while the dialog is closed", () => {
    renderView({ open: false });

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText("100%")).toBeNull();
  });
});
