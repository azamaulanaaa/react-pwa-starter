import { SKIP, visit } from "unist-util-visit";

import { parse } from "@/lib/markdown/index.ts";

/** Defines a feature that the Markdown editor cannot represent yet. */
export type UnsupportedFeature =
  "table" | "image" | "html" | "footnote" | "unknown";

/**
 * Lists the node types that the Markdown editor can represent.
 * Table children stay in this set because the table node reports the feature.
 */
const SUPPORTED_NODE_TYPES = new Set([
  "blockquote",
  "break",
  "code",
  "definition",
  "delete",
  "emphasis",
  "heading",
  "inlineCode",
  "link",
  "linkReference",
  "list",
  "listItem",
  "paragraph",
  "root",
  "strong",
  "table",
  "tableCell",
  "tableRow",
  "text",
  "thematicBreak",
]);

/**
 * Returns the features in one Markdown string that the editor cannot show.
 * The function reads the mdast tree directly, so it does not depend on the
 * validator or on the editor nodes.
 */
export function getUnsupportedFeatures(markdown: string): UnsupportedFeature[] {
  const features = new Set<UnsupportedFeature>();

  visit(parse(markdown), (node) => {
    if (node.type === "table") {
      features.add("table");
      return SKIP;
    }

    if (node.type === "image" || node.type === "imageReference") {
      features.add("image");
      return SKIP;
    }

    if (node.type === "html") {
      features.add("html");
      return SKIP;
    }

    if (
      node.type === "footnoteReference" ||
      node.type === "footnoteDefinition"
    ) {
      features.add("footnote");
      return SKIP;
    }

    if (!SUPPORTED_NODE_TYPES.has(node.type)) {
      features.add("unknown");
    }

    return;
  });

  return [...features];
}
