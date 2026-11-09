import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
  compileMarkdown,
  type MarkdownCompilerConfig,
} from "@/components/editor/compiler.ts";
import { MARKDOWN_EDITOR_NODES } from "@/components/editor/nodes.ts";
import { MARKDOWN_TRANSFORMERS } from "@/components/editor/transformers.ts";
import { canonicalize } from "@/lib/markdown/index.ts";

/**
 * The properties use one seed and one run count, so a failure is reproducible.
 *
 * The compiler must return the canonical form of a supported document. A
 * second compile returns the same string. The compiler does not support a
 * table, so the document grammar leaves out the table block.
 */

vi.mock("@/hooks/engines/use-file-blob.ts", () => ({
  useFileBlob: () => ({ status: "missing", url: null }),
}));

vi.mock("@/components/editor/editor-telemetry.ts", () => ({
  recordEditorEvent: vi.fn(),
}));

const NUM_RUNS = 200;
const SEED = 42;
const OPTIONS = { numRuns: NUM_RUNS, seed: SEED } as const;

const CONFIG: MarkdownCompilerConfig = {
  namespace: "MarkdownCompilerPropertyTest",
  nodes: MARKDOWN_EDITOR_NODES,
  transformers: MARKDOWN_TRANSFORMERS,
};

const WORDS = [
  "alpha",
  "bravo",
  "cedar",
  "delta",
  "echo",
  "fox",
  "golf",
  "hotel",
  "india",
  "juliet",
  "kilo",
  "lima",
  "mike",
  "november",
  "oscar",
  "papa",
  "quebec",
  "romeo",
  "sierra",
  "tango",
  "uniform",
  "victor",
  "whiskey",
  "xray",
  "yankee",
  "zulu",
] as const;

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** Lists the punctuation that the tests add to text atoms. */
const PUNCTUATION = [
  ".",
  ",",
  "!",
  "?",
  ";",
  ":",
  "'",
  '"',
  "(",
  ")",
  "-",
  "*",
  "_",
  "~",
  "`",
  "[",
  "#",
  "+",
  "|",
] as const;

/** Lists the punctuation that the tests allow in inline code. */
const INLINE_CODE_PUNCTUATION = [
  ".",
  ",",
  "!",
  "?",
  ";",
  ":",
  "'",
  '"',
  "(",
  ")",
  "-",
  "*",
  "_",
  "~",
  "[",
  "#",
  "+",
  "|",
] as const;

const ID_CHARS = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-",
] as const;

const CODE_CHARS = [
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?()[]{}_-+=*/",
] as const;

type Inline =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "strong"; readonly text: string }
  | { readonly kind: "emphasis"; readonly text: string }
  | { readonly kind: "delete"; readonly text: string }
  | { readonly kind: "code"; readonly text: string }
  | { readonly kind: "link"; readonly text: string; readonly url: string }
  | { readonly kind: "mention"; readonly label: string; readonly id: string }
  | { readonly kind: "page"; readonly label: string; readonly id: string }
  | { readonly kind: "image"; readonly alt: string; readonly id: string };

type Block =
  | { readonly kind: "paragraph"; readonly children: readonly Inline[] }
  | {
      readonly kind: "heading";
      readonly depth: number;
      readonly children: readonly Inline[];
    }
  | { readonly kind: "blockquote"; readonly children: readonly Inline[] }
  | {
      readonly kind: "unorderedList";
      readonly items: readonly (readonly Inline[])[];
    }
  | {
      readonly kind: "orderedList";
      readonly items: readonly (readonly Inline[])[];
    }
  | {
      readonly kind: "taskList";
      readonly items: readonly {
        readonly checked: boolean;
        readonly children: readonly Inline[];
      }[];
    }
  | {
      readonly kind: "code";
      readonly language: string;
      readonly lines: readonly string[];
    }
  | { readonly kind: "rule" };

/** Adds a backslash before each Markdown metacharacter. */
function escapeText(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|~]/g, "\\$&");
}

const wordArbitrary = fc
  .tuple(
    fc.constantFrom(...WORDS),
    fc.array(fc.constantFrom(...DIGITS), { maxLength: 2 }),
    fc.array(fc.constantFrom(...PUNCTUATION), { maxLength: 2 }),
  )
  .map(([word, digits, marks]) => `${word}${digits.join("")}${marks.join("")}`);

const textArbitrary = fc
  .array(wordArbitrary, { minLength: 1, maxLength: 4 })
  .map((words) => words.join(" "));

const idArbitrary = fc
  .array(fc.constantFrom(...ID_CHARS), { minLength: 1, maxLength: 10 })
  .map((chars) => chars.join(""));

const inlineCodeArbitrary = fc
  .tuple(
    fc.constantFrom(...WORDS),
    fc.array(fc.constantFrom(...DIGITS), { maxLength: 2 }),
    fc.array(fc.constantFrom(...INLINE_CODE_PUNCTUATION), { maxLength: 2 }),
  )
  .map(([word, digits, marks]) => `${word}${digits.join("")}${marks.join("")}`);

const linkUrlArbitrary = fc
  .tuple(fc.constantFrom("https", "mailto", "path"), idArbitrary)
  .map(([kind, id]) => {
    if (kind === "https") return `https://example.com/${id}`;
    if (kind === "mailto") return `mailto:${id}@example.com`;
    return `/docs/${id}`;
  });

const inlineArbitrary: fc.Arbitrary<Inline> = fc.oneof(
  textArbitrary.map((text): Inline => ({ kind: "text", text })),
  textArbitrary.map((text): Inline => ({ kind: "strong", text })),
  textArbitrary.map((text): Inline => ({ kind: "emphasis", text })),
  textArbitrary.map((text): Inline => ({ kind: "delete", text })),
  inlineCodeArbitrary.map((text): Inline => ({ kind: "code", text })),
  fc
    .record({ text: textArbitrary, url: linkUrlArbitrary })
    .map(({ text, url }): Inline => ({ kind: "link", text, url })),
  fc
    .record({ label: textArbitrary, id: idArbitrary })
    .map(({ label, id }): Inline => ({ kind: "mention", label, id })),
  fc
    .record({ label: textArbitrary, id: idArbitrary })
    .map(({ label, id }): Inline => ({ kind: "page", label, id })),
);

const imageArbitrary: fc.Arbitrary<Inline> = fc
  .record({ alt: textArbitrary, id: idArbitrary })
  .map(({ alt, id }): Inline => ({ kind: "image", alt, id }));

const inlineChildrenArbitrary = fc.array(inlineArbitrary, {
  minLength: 1,
  maxLength: 4,
});

const itemArbitrary = fc.array(inlineArbitrary, { minLength: 1, maxLength: 3 });

const taskItemArbitrary = fc.record({
  checked: fc.boolean(),
  children: inlineChildrenArbitrary,
});

const codeLineArbitrary = fc
  .array(fc.constantFrom(...CODE_CHARS), { minLength: 1, maxLength: 24 })
  .map((chars) => chars.join("").trim())
  .map((line) => (line === "" ? "x" : line));

const paragraphArbitrary = fc.oneof(
  inlineChildrenArbitrary.map((children): Block => ({
    kind: "paragraph",
    children,
  })),
  fc
    .tuple(
      fc.array(inlineArbitrary, { minLength: 0, maxLength: 2 }),
      imageArbitrary,
      fc.array(inlineArbitrary, { minLength: 0, maxLength: 2 }),
    )
    .map(([before, image, after]): Block => ({
      kind: "paragraph",
      children: [...before, image, ...after],
    })),
);

const blockArbitraries: readonly fc.Arbitrary<Block>[] = [
  paragraphArbitrary,
  fc
    .record({
      depth: fc.integer({ min: 1, max: 6 }),
      children: inlineChildrenArbitrary,
    })
    .map(({ depth, children }): Block => ({
      kind: "heading",
      depth,
      children,
    })),
  inlineChildrenArbitrary.map((children): Block => ({
    kind: "blockquote",
    children,
  })),
  fc
    .array(itemArbitrary, { minLength: 1, maxLength: 3 })
    .map((items): Block => ({ kind: "unorderedList", items })),
  fc
    .array(itemArbitrary, { minLength: 1, maxLength: 3 })
    .map((items): Block => ({ kind: "orderedList", items })),
  fc
    .array(taskItemArbitrary, { minLength: 1, maxLength: 3 })
    .map((items): Block => ({ kind: "taskList", items })),
  fc
    .record({
      language: fc.constantFrom("ts", "js", "json", "bash", "text", "md"),
      lines: fc.array(codeLineArbitrary, { minLength: 1, maxLength: 3 }),
    })
    .map(({ language, lines }): Block => ({ kind: "code", language, lines })),
  fc.constant<Block>({ kind: "rule" }),
];

const documentArbitrary = fc
  .array(fc.oneof(...blockArbitraries), { minLength: 1, maxLength: 5 })
  .map(renderDocument);

/** Renders one inline node as Markdown. */
function renderInline(node: Inline): string {
  switch (node.kind) {
    case "text":
      return escapeText(node.text);
    case "strong":
      return `**${escapeText(node.text)}**`;
    case "emphasis":
      return `*${escapeText(node.text)}*`;
    case "delete":
      return `~~${escapeText(node.text)}~~`;
    case "code":
      return `\`${node.text}\``;
    case "link":
      return `[${escapeText(node.text)}](${node.url})`;
    case "mention":
      return `[${escapeText(node.label)}](/users/${node.id})`;
    case "page":
      return `[${escapeText(node.label)}](/pages/${node.id})`;
    case "image":
      return `![${escapeText(node.alt)}](/fs/${node.id})`;
  }
}

/** Joins the children of one block with spaces. */
function renderChildren(children: readonly Inline[]): string {
  return children.map(renderInline).join(" ");
}

/** Renders one block as Markdown. */
function renderBlock(block: Block): string {
  switch (block.kind) {
    case "paragraph":
      return renderChildren(block.children);
    case "heading":
      return `${"#".repeat(block.depth)} ${renderChildren(block.children)}`;
    case "blockquote":
      return `> ${renderChildren(block.children)}`;
    case "unorderedList":
      return block.items.map((item) => `- ${renderChildren(item)}`).join("\n");
    case "orderedList":
      return block.items
        .map((item, index) => `${index + 1}. ${renderChildren(item)}`)
        .join("\n");
    case "taskList":
      return block.items
        .map(
          (item) =>
            `- [${item.checked ? "x" : " "}] ${renderChildren(item.children)}`,
        )
        .join("\n");
    case "code":
      return `\`\`\`${block.language}\n${block.lines.join("\n")}\n\`\`\``;
    case "rule":
      return "---";
  }
}

/** Returns the list family of one block, or null for a block that is not a list. */
function listFamily(block: Block): string | null {
  if (block.kind === "unorderedList") return "unordered";
  if (block.kind === "orderedList") return "ordered";
  if (block.kind === "taskList") return "task";
  return null;
}

/**
 * Renders one document with blank lines between its blocks.
 * A horizontal rule separates two lists of the same family. A blank line
 * between two lists of the same family makes one loose list. Lexical has no
 * node for a loose list, so the compiler cannot return the loose form.
 */
function renderDocument(blocks: readonly Block[]): string {
  const rendered: string[] = [];
  let previous: Block | undefined;

  for (const block of blocks) {
    const family = listFamily(block);

    if (
      previous !== undefined &&
      family !== null &&
      family === listFamily(previous)
    ) {
      rendered.push("---");
    }

    rendered.push(renderBlock(block));
    previous = block;
  }

  return `${rendered.join("\n\n")}\n`;
}

const mentionPageArbitrary = fc
  .record({
    label: textArbitrary,
    mentionId: idArbitrary,
    pageId: idArbitrary,
  })
  .map(({ label, mentionId, pageId }) => ({
    markdown: `${escapeText(label)} [${escapeText(label)}](/users/${mentionId}) [${escapeText(label)}](/pages/${pageId})\n`,
    mentionHref: `](/users/${mentionId})`,
    pageHref: `](/pages/${pageId})`,
  }));

const imageSurvivalArbitrary = fc
  .record({ alt: textArbitrary, id: idArbitrary })
  .map(({ alt, id }) => ({
    markdown: `${escapeText(alt)} ![${escapeText(alt)}](/fs/${id})\n`,
    imageHref: `](/fs/${id})`,
  }));

describe("Markdown compiler properties", () => {
  it("returns the canonical form for each supported document", () => {
    fc.assert(
      fc.property(documentArbitrary, (markdown) => {
        const canonical = canonicalize(markdown);

        expect(compileMarkdown(canonical, CONFIG)).toBe(canonical);
      }),
      OPTIONS,
    );
  });

  it("returns the same Markdown for a second compile", () => {
    fc.assert(
      fc.property(documentArbitrary, (markdown) => {
        const once = compileMarkdown(markdown, CONFIG);

        expect(compileMarkdown(once, CONFIG)).toBe(once);
      }),
      OPTIONS,
    );
  });

  it("keeps the href of a mention link and a page link", () => {
    fc.assert(
      fc.property(
        mentionPageArbitrary,
        ({ markdown, mentionHref, pageHref }) => {
          const compiled = compileMarkdown(canonicalize(markdown), CONFIG);

          expect(compiled).toContain(mentionHref);
          expect(compiled).toContain(pageHref);
        },
      ),
      OPTIONS,
    );
  });

  it("keeps the href of an image link", () => {
    fc.assert(
      fc.property(imageSurvivalArbitrary, ({ markdown, imageHref }) => {
        const compiled = compileMarkdown(canonicalize(markdown), CONFIG);

        expect(compiled).toContain(imageHref);
      }),
      OPTIONS,
    );
  });
});
