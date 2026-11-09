// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type NestedRecord,
  TranslationProvider,
} from "@/components/context/translation.tsx";
import { MarkdownView } from "@/components/markdown/markdown-view.tsx";

import enDictionary from "~/public/locales/en-US.json" with { type: "json" };
import idDictionary from "~/public/locales/id-ID.json" with { type: "json" };

const { getFile, worker } = vi.hoisted(() => {
  const get = vi.fn();
  return { getFile: get, worker: { fs: { Get: get } } };
});

vi.mock("@/components/context/worker.tsx", () => ({
  useOptionalWorker: () => worker,
}));

const createObjectUrl = vi.fn(() => "blob:test-url");
const revokeObjectUrl = vi.fn();

function Providers({
  children,
  dictionary = enDictionary,
}: {
  children: ReactNode;
  dictionary?: NestedRecord;
}) {
  return (
    <TranslationProvider
      dictionary={dictionary}
      fallbackDictionary={enDictionary}
    >
      {children}
    </TranslationProvider>
  );
}

function renderMarkdown(
  markdown: string,
  options: {
    dictionary?: NestedRecord;
    onLinkClick?: (href: string) => void;
  } = {},
) {
  return render(
    <Providers dictionary={options.dictionary}>
      <MarkdownView markdown={markdown} onLinkClick={options.onLinkClick} />
    </Providers>,
  );
}

beforeEach(() => {
  getFile.mockReset();
  createObjectUrl.mockClear();
  revokeObjectUrl.mockClear();

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectUrl,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectUrl,
    writable: true,
  });
});

describe("MarkdownView", () => {
  it("uses the shared markdown-body class", () => {
    const { container } = renderMarkdown("# Heading");

    const body = container.querySelector(".markdown-body");
    expect(body).not.toBeNull();
    expect(body?.getAttribute("data-slot")).toBe("markdown-view");
  });

  it("renders headings, paragraphs, inline styles, lists, a quote, and a code fence", () => {
    const markdown = [
      "# Heading",
      "",
      "A **bold** and *italic* paragraph.",
      "",
      "- First",
      "- Second",
      "",
      "> A quote.",
      "",
      "```ts",
      "const value: number = 1;",
      "```",
    ].join("\n");

    const { container } = renderMarkdown(markdown);

    expect(
      screen.getByRole("heading", { level: 1, name: "Heading" }),
    ).toBeDefined();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container.querySelector("blockquote")).not.toBeNull();

    const code = container.querySelector("code.language-ts");
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain("const value: number = 1;");

    const codeRegion = screen.getByRole("region", { name: "Code block" });
    expect(codeRegion.querySelector("pre")).not.toBeNull();
  });

  it("wraps a table in an overflow region", () => {
    const markdown = [
      "| Name | Value |",
      "| --- | --- |",
      "| Alpha | 1 |",
    ].join("\n");

    renderMarkdown(markdown);

    const region = screen.getByRole("region", { name: "Table" });
    expect(region.className).toContain("md-table-wrap");
    expect(within(region).getByRole("table")).toBeDefined();
    expect(within(region).getByText("Alpha")).toBeDefined();
  });

  it("renders a mention link and a page link as chips", () => {
    renderMarkdown("[Alice](/users/123) and [Q3 Plan](/pages/456)");

    const mention = screen.getByRole("link", { name: "Alice" });
    expect(mention.getAttribute("href")).toBe("/users/123");
    expect(mention.getAttribute("data-chip")).toBe("mention");
    expect(mention.getAttribute("data-mention-id")).toBe("123");
    expect(mention.className).toContain("md-chip-mention");

    const page = screen.getByRole("link", { name: "Q3 Plan" });
    expect(page.getAttribute("href")).toBe("/pages/456");
    expect(page.getAttribute("data-chip")).toBe("page");
    expect(page.getAttribute("data-page-id")).toBe("456");
    expect(page.className).toContain("md-chip-page");
  });

  it("keeps an external https link and sends the href to the click handler", () => {
    const onLinkClick = vi.fn();
    renderMarkdown("[Docs](https://example.com/docs)", { onLinkClick });

    const link = screen.getByRole("link", { name: "Docs" });
    expect(link.getAttribute("href")).toBe("https://example.com/docs");

    fireEvent.click(link);

    expect(onLinkClick).toHaveBeenCalledWith("https://example.com/docs");
  });

  it("removes links with a forbidden scheme or a protocol-relative host", () => {
    const markdown = [
      "[js](javascript:alert(1))",
      "[data](data:text/html;base64,AAAA)",
      "[proto](//evil.example/path)",
    ].join(" ");

    const { container } = renderMarkdown(markdown);

    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(screen.getByText("js").tagName).toBe("SPAN");
    expect(screen.getByText("data").tagName).toBe("SPAN");
    expect(screen.getByText("proto").tagName).toBe("SPAN");
  });

  it("does not render raw HTML", () => {
    const markdown = [
      "# Title",
      "",
      '<script>alert("x")</script>',
      "",
      "<b>raw bold</b>",
      "",
      "Plain text.",
    ].join("\n");

    const { container } = renderMarkdown(markdown);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("raw bold").tagName).toBe("P");
    expect(screen.getByText("Plain text.")).toBeDefined();
  });

  it("loads a /fs/ image through the worker file store", async () => {
    getFile.mockResolvedValue({
      blob: new Blob(["image"], { type: "image/png" }),
      id: "cat_1",
      mimetype: "image/png",
      name: "cat.png",
      size: 5,
    });

    const { unmount } = renderMarkdown("![A cat](/fs/cat_1)");

    const image = await screen.findByRole("img", { name: "A cat" });
    expect(image.getAttribute("src")).toBe("blob:test-url");
    expect(getFile).toHaveBeenCalledWith("cat_1");
    expect(createObjectUrl).toHaveBeenCalledTimes(1);

    unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test-url");
  });

  it("shows the alt text and the unavailable state for a missing file", async () => {
    getFile.mockResolvedValue(null);

    renderMarkdown("![A cat](/fs/missing_1)");

    expect(await screen.findByText("File unavailable")).toBeDefined();
    expect(screen.getByText("A cat")).toBeDefined();
    expect(getFile).toHaveBeenCalledWith("missing_1");
  });

  it("shows the unavailable state for an image outside /fs/", () => {
    renderMarkdown("![External](https://example.com/cat.png)");

    expect(screen.getByText("File unavailable")).toBeDefined();
    expect(screen.getByText("External")).toBeDefined();
    expect(getFile).not.toHaveBeenCalled();
  });

  it("renders the empty state for an empty or blank document", () => {
    const first = renderMarkdown("");
    expect(screen.getByText("No content.")).toBeDefined();
    first.unmount();

    renderMarkdown("   \n\n  ");
    expect(screen.getByText("No content.")).toBeDefined();
  });

  it.each([
    ["en-US", enDictionary, "Hello **world** 👋 你好 **世界**", "world"],
    ["id-ID", idDictionary, "Halo **dunia** 👋 你好 **世界**", "dunia"],
  ])(
    "renders %s text, emoji, and CJK text",
    (_locale, dictionary, markdown, word) => {
      renderMarkdown(markdown, { dictionary });

      expect(screen.getByText(word).tagName).toBe("STRONG");
      expect(screen.getByText("世界").tagName).toBe("STRONG");
      expect(screen.getByText(/👋/)).toBeDefined();
    },
  );

  it("uses the id-ID text for the unavailable state", async () => {
    getFile.mockResolvedValue(null);

    renderMarkdown("![Foto](/fs/missing_2)", { dictionary: idDictionary });

    expect(await screen.findByText("File tidak tersedia")).toBeDefined();
    expect(screen.getByText("Foto")).toBeDefined();
  });
});
