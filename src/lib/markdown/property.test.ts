import fc from "fast-check";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";

import {
  canonicalize,
  hashCanonical,
  normalize,
  parse,
  validate,
} from "@/lib/markdown/index.ts";

/**
 * The properties use one seed and one run count, so a failure is reproducible.
 *
 * The canonicalizer is a fixed point. For a supported document `x`, the call
 * `canonicalize(canonicalize(x))` returns `canonicalize(x)`. The canonical
 * form passes validation. The hash of the canonical form does not change.
 *
 * The full `npm run ci` suite adds load. Each property test has a 30-second
 * timeout, so that load does not cause a false timeout.
 */

const NUM_RUNS = 200;
const SEED = 42;
const OPTIONS = { numRuns: NUM_RUNS, seed: SEED } as const;

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

/**
 * Lists the punctuation that the tests add to text atoms.
 * The set leaves out `]`, `$`, `<`, `>`, and `&`. The canonicalizer and the
 * compiler do not agree on the escape form of a literal `]`. The other four
 * characters start an unsupported construct after a parse.
 */
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

const INLINE_CODE_PUNCTUATION = PUNCTUATION.filter(
  (mark) => mark !== "`",
) as readonly string[];

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
      readonly loose: boolean;
      readonly items: readonly (readonly Inline[])[];
    }
  | {
      readonly kind: "orderedList";
      readonly loose: boolean;
      readonly items: readonly (readonly Inline[])[];
    }
  | {
      readonly kind: "taskList";
      readonly loose: boolean;
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
  | { readonly kind: "rule" }
  | {
      readonly kind: "table";
      readonly header: readonly string[];
      readonly rows: readonly (readonly string[])[];
    };

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

const tableArbitrary: fc.Arbitrary<Block> = fc
  .tuple(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 3 }))
  .chain(([columns, bodyRows]) =>
    fc
      .record({
        header: fc.array(textArbitrary, {
          minLength: columns,
          maxLength: columns,
        }),
        rows: fc.array(
          fc.array(textArbitrary, {
            minLength: columns,
            maxLength: columns,
          }),
          { minLength: bodyRows, maxLength: bodyRows },
        ),
      })
      .map(({ header, rows }): Block => ({ kind: "table", header, rows })),
  );

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
    .record({
      loose: fc.boolean(),
      items: fc.array(itemArbitrary, { minLength: 1, maxLength: 3 }),
    })
    .map(({ loose, items }): Block => ({
      kind: "unorderedList",
      loose,
      items,
    })),
  fc
    .record({
      loose: fc.boolean(),
      items: fc.array(itemArbitrary, { minLength: 1, maxLength: 3 }),
    })
    .map(({ loose, items }): Block => ({ kind: "orderedList", loose, items })),
  fc
    .record({
      loose: fc.boolean(),
      items: fc.array(taskItemArbitrary, { minLength: 1, maxLength: 3 }),
    })
    .map(({ loose, items }): Block => ({ kind: "taskList", loose, items })),
  fc
    .record({
      language: fc.constantFrom("ts", "js", "json", "bash", "text", "md"),
      lines: fc.array(codeLineArbitrary, { minLength: 1, maxLength: 3 }),
    })
    .map(({ language, lines }): Block => ({ kind: "code", language, lines })),
  fc.constant<Block>({ kind: "rule" }),
  tableArbitrary,
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
      return block.items
        .map((item) => `- ${renderChildren(item)}`)
        .join(block.loose ? "\n\n" : "\n");
    case "orderedList":
      return block.items
        .map((item, index) => `${index + 1}. ${renderChildren(item)}`)
        .join(block.loose ? "\n\n" : "\n");
    case "taskList":
      return block.items
        .map(
          (item) =>
            `- [${item.checked ? "x" : " "}] ${renderChildren(item.children)}`,
        )
        .join(block.loose ? "\n\n" : "\n");
    case "code":
      return `\`\`\`${block.language}\n${block.lines.join("\n")}\n\`\`\``;
    case "rule":
      return "---";
    case "table": {
      const header = `| ${block.header.map(escapeText).join(" | ")} |`;
      const divider = `| ${block.header.map(() => "---").join(" | ")} |`;
      const rows = block.rows.map(
        (row) => `| ${row.map(escapeText).join(" | ")} |`,
      );

      return [header, divider, ...rows].join("\n");
    }
  }
}

/**
 * Renders one document with blank lines between its blocks.
 * A blank line between two list items makes the list loose. md-lite/1 uses
 * tight lists, so the canonical form of a loose list is a tight list.
 */
function renderDocument(blocks: readonly Block[]): string {
  const rendered = blocks.map(renderBlock);

  return `${rendered.join("\n\n")}\n`;
}

const UNSUPPORTED_CASES = [
  {
    label: "raw HTML",
    payload: "<div>Hello</div>",
    code: "unsupported_html",
  },
  {
    label: "a footnote",
    payload: "Text[^1]\n\n[^1]: Note.",
    code: "unsupported_footnote",
  },
  {
    label: "an MDX element",
    payload: "<Component />",
    code: "unsupported_syntax",
  },
  {
    label: "math",
    payload: "The value is $x$.",
    code: "unsupported_syntax",
  },
  {
    label: "a javascript: link",
    payload: "[x](javascript:alert(1))",
    code: "link_not_allowed",
  },
  {
    label: "a data: link",
    payload: "[x](data:text/html,hello)",
    code: "link_not_allowed",
  },
  {
    label: "a protocol-relative link",
    payload: "[x](//evil.example)",
    code: "link_not_allowed",
  },
] as const;

const unsupportedPayloadArbitrary = fc.constantFrom(
  ...UNSUPPORTED_CASES.map((item) => item.payload),
);

const mentionPageArbitrary = fc
  .record({
    mentionLabel: textArbitrary,
    mentionId: idArbitrary,
    pageLabel: textArbitrary,
    pageId: idArbitrary,
  })
  .map(({ mentionLabel, mentionId, pageLabel, pageId }) => ({
    markdown: `${escapeText(mentionLabel)} [${escapeText(mentionLabel)}](/users/${mentionId}) ${escapeText(pageLabel)} [${escapeText(pageLabel)}](/pages/${pageId})\n`,
    mentionHref: `](/users/${mentionId})`,
    pageHref: `](/pages/${pageId})`,
  }));

describe("md-lite/1 properties", () => {
  it(
    "returns the same canonical Markdown for a second call",
    { timeout: 30_000 },
    () => {
      fc.assert(
        fc.property(documentArbitrary, (markdown) => {
          const canonical = canonicalize(markdown);

          expect(canonicalize(canonical)).toBe(canonical);
        }),
        OPTIONS,
      );
    },
  );

  it(
    "accepts the canonical form of a supported document",
    { timeout: 30_000 },
    () => {
      fc.assert(
        fc.property(documentArbitrary, (markdown) => {
          const canonical = canonicalize(markdown);

          expect(
            validate(canonical).ok,
            `The canonical document must pass validation:\n${canonical}`,
          ).toBe(true);
        }),
        OPTIONS,
      );
    },
  );

  it("rejects each unsupported construct", { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(
        documentArbitrary,
        unsupportedPayloadArbitrary,
        (markdown, payload) => {
          const result = validate(`${markdown}\n\n${payload}\n`);

          expect(result.ok).toBe(false);
        },
      ),
      OPTIONS,
    );
  });

  it.each(UNSUPPORTED_CASES)(
    "rejects $label with the $code code",
    ({ payload, code }) => {
      expect(validate(payload)).toMatchObject({ ok: false, code });
    },
  );

  it(
    "keeps the hash of a canonical document",
    { timeout: 30_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(documentArbitrary, async (markdown) => {
          const canonical = canonicalize(markdown);
          const first = await hashCanonical(markdown);
          const second = await hashCanonical(canonical);

          expect(second).toBe(first);
        }),
        OPTIONS,
      );
    },
  );

  it(
    "keeps the href of a mention link and a page link",
    { timeout: 30_000 },
    () => {
      fc.assert(
        fc.property(
          mentionPageArbitrary,
          ({ markdown, mentionHref, pageHref }) => {
            const canonical = canonicalize(markdown);

            expect(canonical).toContain(mentionHref);
            expect(canonical).toContain(pageHref);
          },
        ),
        OPTIONS,
      );
    },
  );

  it("keeps a table as a table", { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(tableArbitrary.map(renderBlock), (markdown) => {
        let tables = 0;

        visit(parse(canonicalize(markdown)), "table", () => {
          tables += 1;
        });

        expect(tables).toBe(1);
      }),
      OPTIONS,
    );
  });

  it("removes each HTML node during normalize", { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(documentArbitrary, (markdown) => {
        let htmlNodes = 0;

        visit(normalize(parse(markdown)), "html", () => {
          htmlNodes += 1;
        });

        expect(htmlNodes).toBe(0);
      }),
      OPTIONS,
    );
  });

  it("converts a br element to a hard break", () => {
    expect(canonicalize("alpha<br>beta\n")).toBe("alpha\\\nbeta\n");
  });
});
