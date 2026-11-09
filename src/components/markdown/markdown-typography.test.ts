import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const STYLES = readFileSync(new URL("./markdown.css", import.meta.url), "utf8");
const STORIES = readFileSync(new URL("./stories.tsx", import.meta.url), "utf8");
const APP_STYLES = readFileSync(
  new URL("../../app.css", import.meta.url),
  "utf8",
);
const EDITOR_STORIES = readFileSync(
  new URL("../editor/stories.tsx", import.meta.url),
  "utf8",
);

/** Returns the content of every block that matches one media query. */
function getMediaBlocks(css: string, query: string): string[] {
  const blocks: string[] = [];
  const marker = `@media ${query}`;
  let index = css.indexOf(marker);

  while (index !== -1) {
    const open = css.indexOf("{", index);
    let depth = 0;
    let close = open;

    for (; close < css.length; close += 1) {
      if (css[close] === "{") depth += 1;
      if (css[close] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    blocks.push(css.slice(open + 1, close));
    index = css.indexOf(marker, close);
  }

  return blocks;
}

/** Counts the occurrences of one text fragment. */
function countOccurrences(text: string, fragment: string): number {
  return text.split(fragment).length - 1;
}

describe("Markdown typography", () => {
  it("uses the body type scale and a readable measure", () => {
    expect(STYLES).toMatch(/\.markdown-body \{[\s\S]*?font-size: 1rem;/);
    expect(STYLES).toMatch(/\.markdown-body \{[\s\S]*?line-height: 1\.6;/);
    expect(STYLES).toMatch(/\.markdown-body \{[\s\S]*?max-inline-size: 70ch;/);
  });

  it("sets the paragraph flow to 1.5rem", () => {
    expect(STYLES).toMatch(/\.markdown-body \{[\s\S]*?--md-flow: 1\.5rem;/);
  });

  it("sets the h1 size to 1.875rem at weight 700", () => {
    expect(STYLES).toMatch(
      /\.markdown-body h1 \{[^}]*font-size: 1\.875rem;[^}]*font-weight: 700;/,
    );
  });

  it("sets the h3 size to 1.125rem", () => {
    expect(STYLES).toMatch(/\.markdown-body h3 \{[^}]*font-size: 1\.125rem;/);
  });

  it("sets the paragraph color to the muted foreground", () => {
    expect(STYLES).toMatch(
      /\.markdown-body p,\s*\.markdown-body li,\s*\.markdown-body dd,\s*\.markdown-body dt \{\s*color: var\(--muted-foreground\);/,
    );
  });

  it("sets links to the foreground at weight 500 with a 0.25rem offset", () => {
    expect(STYLES).toMatch(
      /\.markdown-body a \{[^}]*color: var\(--foreground\);/,
    );
    expect(STYLES).toMatch(/\.markdown-body a \{[^}]*font-weight: 500;/);
    expect(STYLES).toMatch(
      /\.markdown-body a \{[^}]*text-underline-offset: 0\.25rem;/,
    );
  });

  it("sets inline code to the muted fill and a 0.8125em size", () => {
    expect(STYLES).toMatch(
      /:not\(pre\) > code,[^}]*border-radius: var\(--radius-md\);[^}]*background: var\(--muted\);[^}]*font-size: 0\.8125em;/,
    );
  });

  it("sets the code block size to 0.8125rem with 0.875rem by 1rem padding", () => {
    expect(STYLES).toMatch(
      /\.markdown-body \.md-code-block pre \{[^}]*padding: 0\.875rem 1rem;[^}]*font-size: 0\.8125rem;/,
    );
  });

  it("keeps the view and editor code blocks at the same size and padding", () => {
    const view = STYLES.match(
      /\.markdown-body \.md-code-block pre \{([^}]*)\}/,
    )?.[1];
    const editor = STYLES.match(
      /\.markdown-body \.markdown-editor-code \{\s*display: block;([^}]*)\}/,
    )?.[1];

    expect(view).toBeDefined();
    expect(editor).toBeDefined();

    for (const property of ["padding", "font-size"]) {
      const viewValue = view?.match(new RegExp(`${property}: ([^;]+);`))?.[1];
      const editorValue = editor?.match(
        new RegExp(`${property}: ([^;]+);`),
      )?.[1];

      expect(viewValue).toBeDefined();
      expect(editorValue).toBe(viewValue);
    }
  });

  it("sets the table cell inline padding to 1rem", () => {
    expect(STYLES).toMatch(
      /\.markdown-body th,\s*\.markdown-body td \{[^}]*padding-inline: 1rem;/,
    );
  });

  it("turns on font smoothing at the root", () => {
    expect(APP_STYLES).toMatch(
      /body \{[^}]*?-webkit-font-smoothing: antialiased;/,
    );
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

describe("Markdown chips", () => {
  const hoverStyles = getMediaBlocks(STYLES, "(hover: hover)").join("\n");

  it("uses the info tint for the mention chip", () => {
    expect(STYLES).toMatch(
      /\.md-chip-mention,[\s\S]*?background: color-mix\(in srgb, var\(--info\) 8%, transparent\);/,
    );
    expect(STYLES).toMatch(
      /\.dark \.markdown-body \.md-chip-mention,[\s\S]*?background: color-mix\(in srgb, var\(--info\) 16%, transparent\);/,
    );
  });

  it("uses the secondary surface for the page chip", () => {
    expect(STYLES).toMatch(
      /\.md-chip-page,[\s\S]*?background: var\(--secondary\);/,
    );
    expect(STYLES).toMatch(
      /\.md-chip-page,[\s\S]*?color: var\(--secondary-foreground\);/,
    );
  });

  it("keeps the mention chip clear of a saturated info border", () => {
    expect(STYLES).toMatch(/\.md-chip,[\s\S]*?border: 1px solid transparent;/);
    expect(STYLES).not.toMatch(/border-color:\s*var\(--info\)/);
  });

  it("keeps the chip hover rules in a hover-capable media query", () => {
    expect(countOccurrences(STYLES, ".md-chip-mention:hover")).toBe(
      countOccurrences(hoverStyles, ".md-chip-mention:hover"),
    );
    expect(countOccurrences(STYLES, ".md-chip-page:hover")).toBe(
      countOccurrences(hoverStyles, ".md-chip-page:hover"),
    );
    expect(hoverStyles).toMatch(
      /color-mix\(in srgb, var\(--info\) 12%, transparent\)/,
    );
    expect(hoverStyles).toMatch(
      /color-mix\(in srgb, var\(--foreground\) 8%, transparent\)/,
    );
  });
});
