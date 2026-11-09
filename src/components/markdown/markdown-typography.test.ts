import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const STYLES = readFileSync(new URL("./markdown.css", import.meta.url), "utf8");
const STORIES = readFileSync(new URL("./stories.tsx", import.meta.url), "utf8");
const EDITOR_STORIES = readFileSync(
  new URL("../editor/stories.tsx", import.meta.url),
  "utf8",
);

describe("Markdown typography", () => {
  it("uses the body type scale and a readable measure", () => {
    expect(STYLES).toMatch(/\.markdown-body \{[\s\S]*?font-size: 1rem;/);
    expect(STYLES).toMatch(/\.markdown-body \{[\s\S]*?line-height: 1\.6;/);
    expect(STYLES).toMatch(/\.markdown-body \{[\s\S]*?max-inline-size: 70ch;/);
  });

  it("keeps tables and code blocks inside their own scroll containers", () => {
    expect(STYLES).toMatch(/\.md-table-wrap \{[\s\S]*?overflow-x: auto;/);
    expect(STYLES).toMatch(
      /\.md-code-block,[\s\S]*?\.markdown-editor-code \{[\s\S]*?overflow-x: auto;/,
    );
  });

  it("lets table headers wrap", () => {
    expect(STYLES).not.toMatch(/\.markdown-body th \{[^}]*white-space: nowrap/);
  });

  it("keeps the story metadata under Markdown and Editor", () => {
    expect(STORIES).toContain('title: "Markdown"');
    expect(EDITOR_STORIES).toContain('title: "Editor"');
    expect(STORIES).toContain("export const Typography");
  });
});
