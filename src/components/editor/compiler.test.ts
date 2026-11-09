import { readdirSync, readFileSync } from "node:fs";

import {
  $createCodeHighlightNode,
  $createCodeNode,
  CodeHighlightNode,
  CodeNode,
} from "@lexical/code";
import { $createLinkNode, LinkNode } from "@lexical/link";
import {
  $createListItemNode,
  $createListNode,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import {
  CODE,
  HEADING,
  LINK,
  QUOTE,
  UNORDERED_LIST,
  type Transformer,
} from "@lexical/markdown";
import {
  $createHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
import {
  $createTextNode,
  $getRoot,
  type Klass,
  type LexicalNode,
  type SerializedEditorState,
} from "lexical";
import { describe, expect, it, vi } from "vitest";

import {
  compileMarkdown,
  createHeadlessMarkdownEditor,
  getMarkdown,
  getUnknownNodeTypes,
  loadMarkdown,
  MARKDOWN_EDITOR_NODE_TYPES,
  type MarkdownCompilerConfig,
  readMarkdown,
  reportUnknownNodeTypes,
} from "@/components/editor/compiler.ts";
import { recordEditorEvent } from "@/components/editor/editor-telemetry.ts";
import {
  $createImageNode,
  ImageNode,
} from "@/components/editor/image-node.tsx";
import { MARKDOWN_EDITOR_NODES } from "@/components/editor/nodes.ts";
import {
  HORIZONTAL_RULE,
  IMAGE,
  MARKDOWN_TRANSFORMERS,
} from "@/components/editor/transformers.ts";
import { canonicalize } from "@/lib/markdown/index.ts";

// The compiler tests do not start a worker. The image node only needs its class.
vi.mock("@/hooks/engines/use-file-blob.ts", () => ({
  useFileBlob: () => ({ status: "missing", url: null }),
}));

vi.mock("@/components/editor/editor-telemetry.ts", () => ({
  recordEditorEvent: vi.fn(),
}));

/** Defines the compiler config for the tests. */
const CONFIG: MarkdownCompilerConfig = {
  namespace: "MarkdownCompilerTest",
  nodes: MARKDOWN_EDITOR_NODES,
  transformers: MARKDOWN_TRANSFORMERS,
};

const FIXTURE_DIRECTORY = new URL(
  "../../lib/markdown/__fixtures__/",
  import.meta.url,
);
const FIXTURE_NAMES = readdirSync(FIXTURE_DIRECTORY).filter(
  (name) => name.endsWith(".md") && !name.endsWith(".canonical.md"),
);
const UNSUPPORTED_FIXTURE_NAMES = new Set(["table.md"]);
const SUPPORTED_FIXTURE_NAMES = FIXTURE_NAMES.filter(
  (name) => !UNSUPPORTED_FIXTURE_NAMES.has(name),
);

/** Reads one Markdown fixture. */
function readFixture(name: string): string {
  return readFileSync(new URL(name, FIXTURE_DIRECTORY), "utf8");
}

/** Creates one headless editor with the test config. */
function createEditor() {
  return createHeadlessMarkdownEditor(CONFIG);
}

/** Loads one Markdown string and returns the editor state. */
function loadState(markdown: string) {
  const editor = createEditor();
  loadMarkdown(editor, markdown, CONFIG.transformers);

  return editor.getEditorState();
}

/** Builds a fake serialized state with extra node types. */
function fakeState(extraTypes: string[]): SerializedEditorState {
  return {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: "# Secret note",
              type: "text",
              version: 1,
            },
            ...extraTypes.map((type) => ({ type, version: 1 })),
          ],
          direction: null,
          format: "",
          indent: 0,
          textFormat: 0,
          textStyle: "",
          type: "paragraph",
          version: 1,
        },
      ],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  } as unknown as SerializedEditorState;
}

/** Defines the case that covers one node class. */
interface NodeCoverage {
  create: () => LexicalNode;
  transformers: Transformer[];
}

/** Maps each registered node class to a minimal node and its transformers. */
const NODE_COVERAGE = new Map<Klass<LexicalNode>, NodeCoverage>([
  [
    HeadingNode,
    {
      create: () => $createHeadingNode("h1").append($createTextNode("Heading")),
      transformers: [HEADING],
    },
  ],
  [
    QuoteNode,
    {
      create: () => $createQuoteNode().append($createTextNode("Quote")),
      transformers: [QUOTE],
    },
  ],
  [
    ListNode,
    {
      create: () =>
        $createListNode("bullet").append(
          $createListItemNode().append($createTextNode("Item")),
        ),
      transformers: [UNORDERED_LIST],
    },
  ],
  [
    ListItemNode,
    {
      create: () =>
        $createListNode("bullet").append(
          $createListItemNode().append($createTextNode("Item")),
        ),
      transformers: [UNORDERED_LIST],
    },
  ],
  [
    CodeNode,
    {
      create: () =>
        $createCodeNode("ts").append($createCodeHighlightNode("const id = 1;")),
      transformers: [CODE],
    },
  ],
  [
    CodeHighlightNode,
    {
      create: () =>
        $createCodeNode("ts").append($createCodeHighlightNode("const id = 1;")),
      transformers: [CODE],
    },
  ],
  [
    LinkNode,
    {
      create: () =>
        $createLinkNode("https://example.com").append($createTextNode("Link")),
      transformers: [LINK],
    },
  ],
  [
    HorizontalRuleNode,
    {
      create: () => $createHorizontalRuleNode(),
      transformers: [HORIZONTAL_RULE],
    },
  ],
  [
    ImageNode,
    {
      create: () =>
        $createImageNode({ alt: "Diagram", src: "/fs/file_01", title: "" }),
      transformers: [IMAGE],
    },
  ],
]);

describe("Markdown compiler", () => {
  it.each(SUPPORTED_FIXTURE_NAMES)(
    "round-trips %s through the headless editor",
    (name) => {
      const markdown = readFixture(name);
      const canonical = readFixture(name.replace(/\.md$/, ".canonical.md"));

      expect(compileMarkdown(markdown, CONFIG)).toBe(canonical);
    },
  );

  it("exports the canonical form of each supported feature", () => {
    const cases = [
      "# Title\n",
      "> Quote\n",
      "- one\n- two\n",
      "1. one\n2. two\n",
      "- [ ] Draft\n- [x] Done\n",
      "```ts\nconst id = 1;\n```\n",
      "[Link](https://example.com)\n",
      "*italic* and **bold** and ~~struck~~ and `code`\n",
      "---\n",
      "![Diagram](/fs/file_01)\n",
    ];

    for (const markdown of cases) {
      expect(compileMarkdown(markdown, CONFIG)).toBe(canonicalize(markdown));
    }
  });

  it("returns an empty string for empty input", () => {
    expect(compileMarkdown("", CONFIG)).toBe("");
  });

  it("keeps a mention link exactly", () => {
    expect(compileMarkdown("[Alice](/users/123)\n", CONFIG)).toBe(
      "[Alice](/users/123)\n",
    );
  });

  it("keeps a page link exactly", () => {
    expect(compileMarkdown("[Q3 Plan](/pages/456)\n", CONFIG)).toBe(
      "[Q3 Plan](/pages/456)\n",
    );
  });

  it("returns canonical Markdown for one editor state", () => {
    const state = loadState("A **bold** note.\n");

    expect(readMarkdown(state, CONFIG.transformers)).toBe(
      canonicalize("A **bold** note.\n"),
    );
  });

  it("returns canonical Markdown for the current editor state", () => {
    const editor = createEditor();
    loadMarkdown(editor, "# Title\n", CONFIG.transformers);

    expect(getMarkdown(editor, CONFIG.transformers)).toBe("# Title\n");
  });

  it("is stable after a second compile", () => {
    const once = compileMarkdown(readFixture("basic.md"), CONFIG);

    expect(compileMarkdown(once, CONFIG)).toBe(once);
  });

  it("includes the core node types and every registered node type", () => {
    expect(MARKDOWN_EDITOR_NODE_TYPES).toEqual([
      "root",
      "paragraph",
      "text",
      "linebreak",
      "tab",
      ...MARKDOWN_EDITOR_NODES.map((nodeClass) => nodeClass.getType()),
    ]);
  });

  it("returns no unknown node types for a supported document", () => {
    const state = loadState(
      [
        "# Title",
        "",
        "A **bold** note with a [link](https://example.com).",
        "",
        "> Quote",
        "",
        "- one",
        "- [x] Done",
        "",
        "1. first",
        "",
        "```ts",
        "const id = 1;",
        "```",
        "",
        "---",
        "",
        "![Diagram](/fs/file_01)",
        "",
      ].join("\n"),
    );

    expect(getUnknownNodeTypes(state)).toEqual([]);
  });
});

describe("Markdown compiler node coverage", () => {
  it.each(
    MARKDOWN_EDITOR_NODES.map(
      (nodeClass) => [nodeClass.getType(), nodeClass] as const,
    ),
  )("exports the %s node", (nodeType, nodeClass) => {
    const coverage = NODE_COVERAGE.get(nodeClass as Klass<LexicalNode>);

    if (coverage === undefined) {
      throw new Error(`No transformer exports the "${nodeType}" node.`);
    }

    const editor = createEditor();

    editor.update(
      () => {
        $getRoot().append(coverage.create());
      },
      { discrete: true },
    );

    const output = getMarkdown(editor, coverage.transformers);

    expect(output.trim(), `The "${nodeType}" node did not export.`).not.toBe(
      "",
    );
  });
});

describe("Markdown compiler unknown nodes", () => {
  it("returns each unknown node type one time", () => {
    expect(
      getUnknownNodeTypes(fakeState(["mystery", "mystery", "other"])),
    ).toEqual(["mystery", "other"]);
  });

  it("reports one event for one unknown node type", () => {
    const record = vi.mocked(recordEditorEvent);

    record.mockClear();

    expect(reportUnknownNodeTypes(fakeState(["mystery"]))).toEqual(["mystery"]);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith("editor.unknown_node_export", {
      count: 1,
    });
  });

  it("reports one event for each unknown node type", () => {
    const record = vi.mocked(recordEditorEvent);

    record.mockClear();

    expect(
      reportUnknownNodeTypes(fakeState(["mystery", "other", "other"])),
    ).toEqual(["mystery", "other"]);
    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenNthCalledWith(1, "editor.unknown_node_export", {
      count: 1,
    });
    expect(record).toHaveBeenNthCalledWith(2, "editor.unknown_node_export", {
      count: 2,
    });
  });

  it("does not send Markdown content", () => {
    const record = vi.mocked(recordEditorEvent);

    record.mockClear();
    reportUnknownNodeTypes(fakeState(["mystery"]));

    expect(record).toHaveBeenCalledWith("editor.unknown_node_export", {
      count: 1,
    });
    expect(JSON.stringify(record.mock.calls)).not.toContain("Secret note");
  });
});
