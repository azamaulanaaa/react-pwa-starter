/**
 * Paste plugin for the Markdown editor.
 *
 * The plugin parses plain-text Markdown into rich text when the clipboard has
 * no rich data. It leaves HTML and Lexical JSON to the Lexical importer. It
 * also removes links with an unsafe URL from the editor.
 */

import { useEffect } from "react";
import { LinkNode } from "@lexical/link";
import {
  $convertFromMarkdownString,
  type Transformer,
} from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $parseSerializedNode,
  COMMAND_PRIORITY_HIGH,
  createEditor,
  PASTE_COMMAND,
  type SerializedLexicalNode,
} from "lexical";

import { MARKDOWN_EDITOR_NODES } from "@/components/editor/nodes.ts";
import { validateUrl } from "@/components/editor/url.ts";
import { canonicalize } from "@/lib/markdown/index.ts";

/** Defines the namespace for the temporary Markdown editor. */
const PASTE_NAMESPACE = "MarkdownEditorPaste";

/** Matches an ATX heading at the start of a line. */
const HEADING_PATTERN = /^[ \t]{0,3}#{1,6}[ \t]+\S/m;

/** Matches a list marker at the start of a line. */
const LIST_PATTERN = /^[ \t]{0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+\S/m;

/** Matches a blockquote marker at the start of a line. */
const QUOTE_PATTERN = /^[ \t]{0,3}>[ \t]?\S/m;

/** Matches the start of a fenced code block. */
const FENCE_PATTERN = /^[ \t]{0,3}(?:```|~~~)/m;

/** Matches an inline image. */
const IMAGE_PATTERN = /!\[[^\]\n]*\]\([^)\s]+(?:\s+"[^"\n]*")?\)/;

/** Matches an inline link that is not an image. */
const LINK_PATTERN = /(?:^|[^!])\[[^\]\n]*\]\([^)\s]+(?:\s+"[^"\n]*")?\)/m;

/** Matches strong text with asterisks. */
const STRONG_STAR_PATTERN = /\*\*(?=\S)[\s\S]*?(?<=\S)\*\*/;

/** Matches strong text with underscores. */
const STRONG_UNDERSCORE_PATTERN = /__(?=\S)[\s\S]*?(?<=\S)__/;

/** Matches strikethrough text. */
const STRIKE_PATTERN = /~~(?=\S)[\s\S]*?(?<=\S)~~/;

/** Matches emphasized text with asterisks. */
const EMPHASIS_STAR_PATTERN =
  /(?:^|[^\w*])\*(?=[^\s*])[^*\n]*?(?<=[^\s*])\*(?:[^\w*]|$)/m;

/** Matches emphasized text with underscores. */
const EMPHASIS_UNDERSCORE_PATTERN =
  /(?:^|[^\w_])_(?=[^\s_])[^_\n]*?(?<=[^\s_])_(?:[^\w_]|$)/m;

/**
 * Returns true when one clipboard type is present.
 * The function accepts a `DOMStringList` and a string array.
 */
function hasClipboardType(
  dataTransfer: DataTransfer,
  mimeType: string,
): boolean {
  return Array.from(dataTransfer.types).includes(mimeType);
}

/**
 * Returns true when the clipboard holds rich data that Lexical must import.
 */
export function hasRichClipboardData(dataTransfer: DataTransfer): boolean {
  return (
    hasClipboardType(dataTransfer, "text/html") ||
    hasClipboardType(dataTransfer, "application/x-lexical-editor")
  );
}

/**
 * Returns true when one string contains clear Markdown syntax.
 * Plain prose returns false, so the editor keeps it as plain text.
 */
export function hasMarkdownSyntax(text: string): boolean {
  return (
    HEADING_PATTERN.test(text) ||
    LIST_PATTERN.test(text) ||
    QUOTE_PATTERN.test(text) ||
    FENCE_PATTERN.test(text) ||
    IMAGE_PATTERN.test(text) ||
    LINK_PATTERN.test(text) ||
    STRONG_STAR_PATTERN.test(text) ||
    STRONG_UNDERSCORE_PATTERN.test(text) ||
    STRIKE_PATTERN.test(text) ||
    EMPHASIS_STAR_PATTERN.test(text) ||
    EMPHASIS_UNDERSCORE_PATTERN.test(text)
  );
}

/**
 * Returns one deep copy of a serialized node.
 * The copy separates the temporary editor from the target editor.
 */
function cloneSerializedNode<T extends SerializedLexicalNode>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

/**
 * Converts one Markdown string to serialized nodes.
 * The function uses a temporary editor, so the current document stays intact.
 */
export function convertMarkdownToSerializedNodes(
  markdown: string,
  transformers: Transformer[],
): SerializedLexicalNode[] {
  const editor = createEditor({
    namespace: PASTE_NAMESPACE,
    nodes: MARKDOWN_EDITOR_NODES,
    onError: (error) => {
      throw error;
    },
  });

  editor.update(
    () => {
      $convertFromMarkdownString(canonicalize(markdown), transformers);
    },
    { discrete: true },
  );

  const children = editor.getEditorState().toJSON().root.children;

  return children.map((node) => cloneSerializedNode(node));
}

/**
 * Inserts one Markdown string at the current range selection.
 * The caller must run this function inside an editor update.
 */
function $insertMarkdownNodes(
  markdown: string,
  transformers: Transformer[],
): boolean {
  const selection = $getSelection();

  if (!$isRangeSelection(selection)) return false;

  const serializedNodes = convertMarkdownToSerializedNodes(
    markdown,
    transformers,
  );

  if (serializedNodes.length === 0) return false;

  const nodes = serializedNodes.map((node) => $parseSerializedNode(node));

  if (nodes.length === 0) return false;

  selection.insertNodes(nodes);

  return true;
}

/**
 * Removes one link when its URL is not safe.
 * The function keeps the link text and drops the URL.
 */
function $sanitizeLinkUrl(node: LinkNode): void {
  if (validateUrl(node.getURL())) return;

  const children = node.getChildren();

  for (const child of children) {
    node.insertBefore(child);
  }

  node.remove();
}

/** Defines the props of the paste plugin. */
export interface PasteMarkdownPluginProps {
  /** Parses pasted plain-text Markdown when the value is true. */
  enabled?: boolean;
  /** The Markdown transformers of the current editor variant. */
  transformers: Transformer[];
}

/** Handles paste events for the Markdown editor. */
export function PasteMarkdownPlugin({
  enabled = true,
  transformers,
}: PasteMarkdownPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () => editor.registerNodeTransform(LinkNode, $sanitizeLinkUrl),
    [editor],
  );

  useEffect(() => {
    if (!enabled) return undefined;

    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const dataTransfer = (event as ClipboardEvent).clipboardData;

        if (dataTransfer === null || dataTransfer === undefined) return false;
        if (hasRichClipboardData(dataTransfer)) return false;

        const text = dataTransfer.getData("text/plain");

        if (!hasMarkdownSyntax(text)) return false;
        if (!$insertMarkdownNodes(text, transformers)) return false;

        event.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, enabled, transformers]);

  return null;
}
