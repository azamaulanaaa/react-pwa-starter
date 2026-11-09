import { readdirSync, readFileSync } from "node:fs";

import { createHeadlessEditor } from "@lexical/headless";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from "@lexical/markdown";
import { describe, expect, it } from "vitest";

import { MARKDOWN_EDITOR_NODES } from "@/components/editor/nodes.ts";
import { MARKDOWN_TRANSFORMERS } from "@/components/editor/transformers.ts";
import { canonicalize } from "@/lib/markdown/index.ts";

const FIXTURE_DIRECTORY = new URL(
  "../../lib/markdown/__fixtures__/",
  import.meta.url,
);
const FIXTURE_NAMES = readdirSync(FIXTURE_DIRECTORY).filter(
  (name) => name.endsWith(".md") && !name.endsWith(".canonical.md"),
);

function readFixture(name: string): string {
  return readFileSync(new URL(name, FIXTURE_DIRECTORY), "utf8");
}

/** Converts Markdown to an editor state and back to canonical Markdown. */
function roundTrip(markdown: string): string {
  const editor = createHeadlessEditor({
    namespace: "MarkdownTransformerTest",
    nodes: MARKDOWN_EDITOR_NODES,
    onError: (error) => {
      throw error;
    },
  });

  editor.update(
    () => {
      $convertFromMarkdownString(canonicalize(markdown), MARKDOWN_TRANSFORMERS);
    },
    { discrete: true },
  );

  let output = "";

  editor.getEditorState().read(() => {
    output = canonicalize($convertToMarkdownString(MARKDOWN_TRANSFORMERS));
  });

  return output;
}

describe("Markdown transformers", () => {
  it.each(FIXTURE_NAMES)(
    "round-trips %s through the standard transformer set",
    (name) => {
      const markdown = readFixture(name);
      const canonical = readFixture(name.replace(/\.md$/, ".canonical.md"));

      expect(roundTrip(markdown)).toBe(canonical);
    },
  );
});
