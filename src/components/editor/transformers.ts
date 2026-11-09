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

/**
 * The standard set of Markdown transformers.
 * The check list transformer comes before the unordered list transformer.
 * The unordered list transformer reads `- [ ]` as a plain list item otherwise.
 */
export const MARKDOWN_TRANSFORMERS: Transformer[] = [
  HEADING,
  QUOTE,
  CHECK_LIST,
  UNORDERED_LIST,
  ORDERED_LIST,
  CODE,
  ...TEXT_FORMAT_TRANSFORMERS,
  LINK,
];

/** The plain set of Markdown transformers. It keeps links and inline formats. */
export const PLAIN_TRANSFORMERS: Transformer[] = [
  LINK,
  ...TEXT_FORMAT_TRANSFORMERS,
];

/** The full set of Markdown transformers. Later issues add more blocks. */
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
