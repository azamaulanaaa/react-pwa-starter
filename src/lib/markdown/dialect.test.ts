import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  canonicalize,
  hashCanonical,
  MARKDOWN_MAX_BYTES,
  MARKDOWN_MAX_LIST_DEPTH,
  MARKDOWN_MAX_TABLE_COLUMNS,
  MARKDOWN_MAX_TABLE_ROWS,
  validate,
} from "@/lib/markdown/index.ts";

const FIXTURE_DIRECTORY = new URL("./__fixtures__/", import.meta.url);
const FIXTURE_NAMES = readdirSync(FIXTURE_DIRECTORY).filter(
  (name) => name.endsWith(".md") && !name.endsWith(".canonical.md"),
);

function readFixture(name: string): string {
  return readFileSync(new URL(name, FIXTURE_DIRECTORY), "utf8");
}

function tableMarkdown(columns: number, rows: number): string {
  const header = `| ${Array.from({ length: columns }, (_, index) => `h${index}`).join(" | ")} |`;
  const delimiter = `| ${Array.from({ length: columns }, () => "---").join(" | ")} |`;
  const body = Array.from(
    { length: rows },
    () => `| ${Array.from({ length: columns }, () => "x").join(" | ")} |`,
  ).join("\n");

  return `${header}\n${delimiter}\n${body}\n`;
}

describe("canonical Markdown", () => {
  it.each(FIXTURE_NAMES)("keeps %s as a fixed point", (name) => {
    const input = readFixture(name);
    const canonical = readFixture(name.replace(/\.md$/, ".canonical.md"));

    expect(canonicalize(input)).toBe(canonical);
    expect(canonicalize(canonical)).toBe(canonical);
    expect(canonicalize(canonicalize(input))).toBe(canonicalize(input));
  });

  it("returns the same string for a second canonicalize call", () => {
    const input = "# Title\n\nText with **bold** words.\n";
    const once = canonicalize(input);

    expect(canonicalize(once)).toBe(once);
  });

  it("round-trips a mention link and a page link", () => {
    const markdown = "[Alice](/users/123) and [Q3 Plan](/pages/456)\n";

    expect(canonicalize(markdown)).toBe(markdown);
  });

  it("keeps emphasis, a blockquote, and an ordered list", () => {
    const markdown = [
      "*italic* and **bold** and ~~struck~~",
      "",
      "> quote",
      "",
      "1. one",
      "2. two",
      "",
    ].join("\n");

    expect(canonicalize(markdown)).toBe(markdown);
  });

  it("keeps a table, a task list, and fenced code", () => {
    const markdown = [
      "| Name | Value |",
      "| --- | --- |",
      "| A | 1 |",
      "",
      "- [ ] Draft the plan",
      "- [x] Review the plan",
      "",
      "```ts",
      'const id: string = "abc";',
      "```",
      "",
    ].join("\n");

    const canonical = canonicalize(markdown);

    expect(canonical).toContain("| Name | Value |");
    expect(canonical).toContain("- [ ] Draft the plan");
    expect(canonical).toContain("- [x] Review the plan");
    expect(canonical).toContain('```ts\nconst id: string = "abc";\n```');
  });
});

describe("normalize", () => {
  it.each([
    ["a setext heading", "Title\n=====\n", "# Title\n"],
    [
      "an autolink",
      "<https://example.com>\n",
      "[https://example.com](https://example.com)\n",
    ],
    ["a two-space hard break", "a  \nb\n", "a\\\nb\n"],
    ["a line break element", "a<br>b\n", "a\\\nb\n"],
    ["indented code", "    const id = 1;\n", "```\nconst id = 1;\n```\n"],
    [
      "a reference link",
      "[Q3 Plan][plan]\n\n[plan]: /pages/456\n",
      "[Q3 Plan](/pages/456)\n",
    ],
  ])("converts %s", (_label, input, canonical) => {
    expect(canonicalize(input)).toBe(canonical);
  });

  it("removes a byte order mark and converts CRLF to LF", () => {
    expect(canonicalize("\uFEFF# Title\r\n\r\nText\r\n")).toBe(
      "# Title\n\nText\n",
    );
  });
});

describe("validate", () => {
  it.each([
    ["javascript:", "[x](javascript:alert(1))"],
    ["data:", "[x](data:text/html,hello)"],
    ["a protocol-relative URL", "[x](//evil.example)"],
    ["vbscript:", "[x](vbscript:msgbox)"],
    ["file:", "[x](file:///etc/passwd)"],
    ["blob:", "[x](blob:abc)"],
  ])("rejects a %s link", (_label, markdown) => {
    expect(validate(markdown)).toMatchObject({
      ok: false,
      code: "link_not_allowed",
    });
  });

  it.each([
    ["raw HTML", "<div>Hello</div>", "unsupported_html"],
    ["a footnote", "Text[^1]\n\n[^1]: Note.\n", "unsupported_footnote"],
    ["math", "The value is $x$.\n", "unsupported_syntax"],
    ["an MDX element", "<Component />\n", "unsupported_syntax"],
  ])("rejects %s", (_label, markdown, code) => {
    expect(validate(markdown)).toMatchObject({ ok: false, code });
  });

  it.each([
    ["a remote image", "![x](https://example.com/a.png)\n"],
    ["a data image", "![x](data:image/png;base64,abc)\n"],
  ])("rejects %s", (_label, markdown) => {
    expect(validate(markdown)).toMatchObject({
      ok: false,
      code: "image_not_allowed",
    });
  });

  it("accepts an image path that starts with /fs/", () => {
    expect(validate("![Diagram](/fs/file_01)\n")).toMatchObject({ ok: true });
  });

  it("accepts a mention and a page with a valid identifier", () => {
    expect(validate("[Alice](/users/123)\n[Q3 Plan](/pages/456)\n")).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it("rejects a mention with an invalid identifier", () => {
    expect(validate("[Alice](/users/123!)\n")).toMatchObject({
      ok: false,
      code: "link_not_allowed",
    });
  });

  it("accepts exactly 100 KB of Markdown", () => {
    expect(validate("a".repeat(MARKDOWN_MAX_BYTES))).toMatchObject({
      ok: true,
    });
  });

  it("rejects Markdown over 100 KB", () => {
    expect(validate("a".repeat(MARKDOWN_MAX_BYTES + 1))).toMatchObject({
      ok: false,
      code: "too_large",
    });
  });

  it("accepts a list at the depth limit", () => {
    const markdown = "- one\n  - two\n    - three\n";

    expect(MARKDOWN_MAX_LIST_DEPTH).toBe(3);
    expect(validate(markdown)).toMatchObject({ ok: true });
  });

  it("rejects a list over the depth limit", () => {
    const markdown = "- one\n  - two\n    - three\n      - four\n";

    expect(validate(markdown)).toMatchObject({
      ok: false,
      code: "too_deep",
    });
  });

  it("accepts a table at the width limit", () => {
    const markdown = tableMarkdown(MARKDOWN_MAX_TABLE_COLUMNS, 1);

    expect(validate(markdown)).toMatchObject({ ok: true });
  });

  it("rejects a table over the width limit", () => {
    const markdown = tableMarkdown(MARKDOWN_MAX_TABLE_COLUMNS + 1, 1);

    expect(validate(markdown)).toMatchObject({
      ok: false,
      code: "too_wide",
    });
  });

  it("accepts a table at the row limit", () => {
    const markdown = tableMarkdown(1, MARKDOWN_MAX_TABLE_ROWS);

    expect(validate(markdown)).toMatchObject({ ok: true });
  });

  it("rejects a table over the row limit", () => {
    const markdown = tableMarkdown(1, MARKDOWN_MAX_TABLE_ROWS + 1);

    expect(validate(markdown)).toMatchObject({
      ok: false,
      code: "too_long",
    });
  });

  it("returns the canonical string and a matching hash", async () => {
    const result = validate("# Title\r\n\r\nText\r\n");

    expect(result).toMatchObject({ ok: true, canonical: "# Title\n\nText\n" });
    if (!result.ok) {
      throw new Error("The document must pass validation.");
    }

    await expect(hashCanonical("# Title\r\n\r\nText\r\n")).resolves.toBe(
      result.hash,
    );
  });

  it.each([54, 55, 56, 63, 64, 119, 120])(
    "returns the same hash for a canonical string of %i bytes",
    async (length) => {
      const markdown = "a".repeat(length - 1);
      const result = validate(markdown);

      if (!result.ok) {
        throw new Error("The document must pass validation.");
      }

      await expect(hashCanonical(markdown)).resolves.toBe(result.hash);
    },
  );
});

describe("locale text", () => {
  it.each([
    ["en-US", "A café, a naïve résumé, and an em dash — all stay."],
    ["id-ID", "Halo, dunia! Teks ini tetap sama."],
    ["CJK", "日本語のテキストと中文文本。"],
    ["emoji", "The team ships 🚀 and 👩‍💻."],
  ])("keeps %s text unchanged", (_label, text) => {
    expect(canonicalize(text)).toBe(`${text}\n`);
  });
});
