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
