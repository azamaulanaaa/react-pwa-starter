import {
  CHECK_LIST,
  CODE,
  HEADING,
  LINK,
  ORDERED_LIST,
  QUOTE,
  TEXT_FORMAT_TRANSFORMERS,
  UNORDERED_LIST,
  type Transformer,
} from "@lexical/markdown";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";

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
 * The standard set of Markdown transformers.
 * The check list transformer comes before the unordered list transformer.
 * The unordered list transformer reads `- [ ]` as a plain list item otherwise.
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
