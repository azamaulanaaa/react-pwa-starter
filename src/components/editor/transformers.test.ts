import { readdirSync, readFileSync } from "node:fs";

import { createHeadlessEditor } from "@lexical/headless";
import { $isListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  type Transformer,
} from "@lexical/markdown";
import { $getRoot } from "lexical";
import { describe, expect, it, vi } from "vitest";

import { MARKDOWN_EDITOR_NODES } from "@/components/editor/nodes.ts";
import { getUnsupportedFeatures } from "@/components/editor/support.ts";
import {
  FULL_TRANSFORMERS,
  getTransformers,
  MARKDOWN_TRANSFORMERS,
} from "@/components/editor/transformers.ts";
import { canonicalize } from "@/lib/markdown/index.ts";

// The transformer tests do not start a worker. The image node only needs its class.
vi.mock("@/hooks/engines/use-file-blob.ts", () => ({
  useFileBlob: () => ({ status: "missing", url: null }),
}));

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

/** Creates a headless editor for the transformer tests. */
function createEditor() {
  return createHeadlessEditor({
    namespace: "MarkdownTransformerTest",
    nodes: MARKDOWN_EDITOR_NODES,
    onError: (error) => {
      throw error;
    },
  });
}

/** Converts Markdown to an editor state and back to canonical Markdown. */
function roundTrip(
  markdown: string,
  transformers: Transformer[] = MARKDOWN_TRANSFORMERS,
): string {
  const editor = createEditor();

  editor.update(
    () => {
      $convertFromMarkdownString(canonicalize(markdown), transformers);
    },
    { discrete: true },
  );

  let output = "";

  editor.getEditorState().read(() => {
    output = canonicalize($convertToMarkdownString(transformers));
  });

  return output;
}

describe("Markdown transformers", () => {
  it.each(SUPPORTED_FIXTURE_NAMES)(
    "round-trips %s through the standard transformer set",
    (name) => {
      const markdown = readFixture(name);
      const canonical = readFixture(name.replace(/\.md$/, ".canonical.md"));

      expect(roundTrip(markdown)).toBe(canonical);
    },
  );

  it.each([...UNSUPPORTED_FIXTURE_NAMES])(
    "reports %s as unsupported",
    (name) => {
      expect(getUnsupportedFeatures(readFixture(name))).not.toEqual([]);
    },
  );

  it("converts a horizontal rule to a rule node and back", () => {
    const markdown = "Alpha\n\n---\n\nBeta\n";
    const editor = createEditor();
    const nodeTypes: string[] = [];

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, FULL_TRANSFORMERS);
        nodeTypes.push(
          ...$getRoot()
            .getChildren()
            .map((node) => node.getType()),
        );
      },
      { discrete: true },
    );

    let output = "";

    editor.getEditorState().read(() => {
      output = canonicalize($convertToMarkdownString(FULL_TRANSFORMERS));
    });

    expect(nodeTypes).toContain("horizontalrule");
    expect(output).toBe(canonicalize(markdown));
  });

  it("keeps block syntax as text in the compact set", () => {
    const markdown = [
      "# Title",
      "",
      "- one",
      "",
      "> Quote",
      "",
      "```",
      "code",
      "```",
      "",
      "---",
    ].join("\n");
    const editor = createEditor();
    const transformers = getTransformers("compact");
    const nodeTypes: string[] = [];

    editor.update(
      () => {
        $getRoot().clear();
        $convertFromMarkdownString(canonicalize(markdown), transformers);
        nodeTypes.push(
          ...$getRoot()
            .getChildren()
            .map((node) => node.getType()),
        );
      },
      { discrete: true },
    );

    let output = "";

    editor.getEditorState().read(() => {
      output = canonicalize($convertToMarkdownString(transformers));
    });

    expect(nodeTypes).not.toContain("heading");
    expect(nodeTypes).not.toContain("list");
    expect(nodeTypes).not.toContain("quote");
    expect(nodeTypes).not.toContain("code");
    expect(nodeTypes).not.toContain("horizontalrule");
    expect(nodeTypes.every((type) => type === "paragraph")).toBe(true);
    expect(output).toContain("Title");
    expect(output).toContain("one");
    expect(output).toContain("Quote");
    expect(output).toContain("code");
  });

  it("converts a task list to a check list and back", () => {
    const markdown = readFixture("task-list.md");
    const canonical = readFixture("task-list.canonical.md");
    const editor = createEditor();

    editor.update(
      () => {
        $convertFromMarkdownString(
          canonicalize(markdown),
          MARKDOWN_TRANSFORMERS,
        );
      },
      { discrete: true },
    );

    let firstListType: string | null = null;
    let output = "";

    editor.getEditorState().read(() => {
      const firstChild = $getRoot().getFirstChild();
      firstListType = $isListNode(firstChild) ? firstChild.getListType() : null;
      output = canonicalize($convertToMarkdownString(MARKDOWN_TRANSFORMERS));
    });

    expect(firstListType).toBe("check");
    expect(output).toBe(canonical);
  });
});
