import {
  CHECK_LIST,
  CODE,
  HEADING,
  LINK,
  ORDERED_LIST,
  QUOTE,
  TEXT_FORMAT_TRANSFORMERS,
  UNORDERED_LIST,
  type TextMatchTransformer,
  type Transformer,
} from "@lexical/markdown";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";

import {
  $createImageNode,
  $isImageNode,
  ImageNode,
} from "@/components/editor/image-node.tsx";

/**
 * Converts one horizontal rule line to a horizontal rule node and back.
 * The regular expression matches `---`, `***`, or `___` on a line alone.
 */
export const HORIZONTAL_RULE: Transformer = {
  dependencies: [HorizontalRuleNode],
  export: (node) => ($isHorizontalRuleNode(node) ? "---" : null),
  regExp: /^(?:-{3}|\*{3}|_{3})\s*$/,
  replace: (parentNode) => {
    parentNode.replace($createHorizontalRuleNode());
  },
  type: "element",
};

/**
 * Converts one image to an image node and back.
 * The regular expression accepts `/fs/{id}` sources only.
 */
export const IMAGE: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: (node) =>
    $isImageNode(node) ? `![${node.getAltText()}](${node.getSrc()})` : null,
  importRegExp: /!\[([^\]]*)\]\((\/fs\/[A-Za-z0-9_-]+)\)/,
  regExp: /!\[([^\]]*)\]\((\/fs\/[A-Za-z0-9_-]+)\)/,
  replace: (textNode, match) => {
    const alt = match[1] ?? "";
    const src = match[2];

    if (src === undefined) return;

    textNode.replace($createImageNode({ alt, src, title: "" }));
  },
  type: "text-match",
};

/**
 * The standard set of Markdown transformers.
 * The check list transformer comes before the unordered list transformer.
 * The unordered list transformer reads `- [ ]` as a plain list item otherwise.
 * The image transformer comes before the link transformer, so the leading `!`
 * stays with the image.
 * The set includes the horizontal rule, so the toolbar always round-trips it.
 */
export const MARKDOWN_TRANSFORMERS: Transformer[] = [
  HEADING,
  QUOTE,
  CHECK_LIST,
  UNORDERED_LIST,
  ORDERED_LIST,
  CODE,
  HORIZONTAL_RULE,
  ...TEXT_FORMAT_TRANSFORMERS,
  IMAGE,
  LINK,
];

/** The plain set of Markdown transformers. It keeps links and inline formats. */
export const PLAIN_TRANSFORMERS: Transformer[] = [
  LINK,
  ...TEXT_FORMAT_TRANSFORMERS,
];

/** The full set of Markdown transformers. It matches the standard set. */
export const FULL_TRANSFORMERS: Transformer[] = MARKDOWN_TRANSFORMERS;

/** Defines the Markdown transformer set that one editor variant uses. */
export type MarkdownVariant = "plain" | "standard" | "full";

/**
 * Returns the transformer list for one editor variant.
 * The function returns the same array for each call, so React effects stay
 * stable.
 */
export function getTransformers(variant: MarkdownVariant): Transformer[] {
  if (variant === "plain") return PLAIN_TRANSFORMERS;
  if (variant === "full") return FULL_TRANSFORMERS;
  return MARKDOWN_TRANSFORMERS;
}
