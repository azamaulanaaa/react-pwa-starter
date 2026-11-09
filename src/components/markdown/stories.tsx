import type { Story, StoryDefault } from "@ladle/react";

import { MarkdownView } from "@/components/markdown/markdown-view.tsx";

const DEFAULT_MARKDOWN = [
  "# Release notes",
  "",
  "The new **Markdown view** renders the *canonical* md-lite/1 text.",
  "",
  "- Sanitized HTML",
  "- Mention chips",
  "- Worker images",
  "",
  "> The view is read-only.",
  "",
  "Read the [release guide](https://example.com/releases) for details.",
].join("\n");

const CHIP_MARKDOWN = [
  "## Mentions",
  "",
  "Ask [Alice](/users/123) to review the [Q3 Plan](/pages/456).",
  "",
  "Both links keep the visible label as the accessible name.",
].join("\n");

const CODE_AND_TABLE_MARKDOWN = [
  "## Code and data",
  "",
  "```ts",
  "export function formatBytes(bytes: number): string {",
  '  return new Intl.NumberFormat("en-US").format(bytes) + " B";',
  "}",
  "```",
  "",
  "| Locale | Greeting |",
  "| --- | --- |",
  "| en-US | Hello 👋 |",
  "| id-ID | Halo 👋 |",
  "| zh-CN | 你好 👋 |",
].join("\n");

const MALICIOUS_MARKDOWN = [
  "## Malicious input",
  "",
  "[Safe link](https://example.com)",
  "[Script link](javascript:alert(1))",
  "[Data link](data:text/html;base64,AAAA)",
  "[Protocol-relative link](//evil.example)",
  "",
  "<script>alert(1)</script>",
  "<b>Raw HTML stays off</b>",
  "",
  "![External image](https://example.com/cat.png)",
].join("\n");

const TYPOGRAPHY_MARKDOWN = [
  "# Heading one",
  "",
  "Body text at 16px with **bold**, *italic*, ~~strike~~, `inline code`, and a [link](https://example.com). Ask [Alice](/users/123) or open the [Q3 Plan](/pages/456).",
  "",
  "## Heading two",
  "",
  "A paragraph with a long unbroken value: pneumonoultramicroscopicsilicovolcanoconiosis.",
  "",
  "### Heading three",
  "",
  "#### Heading four",
  "",
  "##### Heading five",
  "",
  "###### Heading six",
  "",
  "Ordered list:",
  "",
  "1. First item",
  "2. Second item",
  "3. Third item",
  "",
  "Unordered list:",
  "",
  "- First item",
  "- Second item",
  "  - Nested item",
  "",
  "Task list:",
  "",
  "- [x] Done",
  "- [ ] Open",
  "",
  "> A quote with a [link](https://example.com) and `inline code`.",
  "",
  "```ts",
  "export function formatBytes(bytes: number): string {",
  '  return new Intl.NumberFormat("en-US").format(bytes) + " B";',
  "}",
  "```",
  "",
  "| Left | Center | Right |",
  "| :--- | :----: | ----: |",
  "| Alpha | Beta | 128 |",
  "| A long cell that wraps at narrow widths | Gamma | 42 |",
  "",
  "![Diagram](https://example.com/diagram.png)",
  "",
  "---",
  "",
  "Final paragraph with a long URL: https://example.com/a/very/long/path/that/keeps/going/without/a/break.",
].join("\n");

export default {
  title: "Markdown",
} as StoryDefault;

export const DefaultView: Story = () => (
  <div className="p-6">
    <MarkdownView markdown={DEFAULT_MARKDOWN} />
  </div>
);

export const MentionChips: Story = () => (
  <div className="p-6">
    <MarkdownView markdown={CHIP_MARKDOWN} />
  </div>
);

export const CodeAndTable: Story = () => (
  <div className="p-6">
    <MarkdownView markdown={CODE_AND_TABLE_MARKDOWN} />
  </div>
);

export const MaliciousInput: Story = () => (
  <div className="p-6">
    <MarkdownView markdown={MALICIOUS_MARKDOWN} />
  </div>
);

export const Empty: Story = () => (
  <div className="p-6">
    <MarkdownView markdown="" />
  </div>
);

/** Shows every prose element at the normal width and in a narrow container. */
export const Typography: Story = () => (
  <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,48rem)_20rem]">
    <div className="min-w-0">
      <MarkdownView markdown={TYPOGRAPHY_MARKDOWN} />
    </div>
    <div className="min-w-0 self-start rounded-lg border border-border p-4">
      <p className="mb-3 text-muted-foreground text-sm">Narrow container</p>
      <MarkdownView markdown={TYPOGRAPHY_MARKDOWN} />
    </div>
  </div>
);
