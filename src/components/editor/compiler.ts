/**
 * Headless Markdown compiler for the Lexical editor.
 *
 * The compiler loads canonical Markdown into a Lexical editor state and
 * exports canonical Markdown. It does not import React, so a test or a worker
 * can use it without a DOM.
 */

import { createHeadlessEditor } from "@lexical/headless";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  type Transformer,
} from "@lexical/markdown";
import {
  $createParagraphNode,
  $getRoot,
  type EditorState,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
  type SerializedEditorState,
  type SerializedLexicalNode,
} from "lexical";

import { recordEditorEvent } from "@/components/editor/editor-telemetry.ts";
import { canonicalize } from "@/lib/markdown/index.ts";

/** Lists the serialized node types that every Lexical editor has. */
const CORE_NODE_TYPES = [
  "root",
  "paragraph",
  "text",
  "linebreak",
  "tab",
] as const;

/**
 * Lists the serialized node types that the Markdown editor can export.
 * The list holds the core types and the type of every registered node.
 * The order matches `MARKDOWN_EDITOR_NODES`.
 */
export const MARKDOWN_EDITOR_NODE_TYPES: readonly string[] = [
  ...CORE_NODE_TYPES,
  "heading",
  "quote",
  "list",
  "listitem",
  "code",
  "code-highlight",
  "link",
  "horizontalrule",
  "image",
];

/** Defines the lookup set for the supported node types. */
const SUPPORTED_NODE_TYPES = new Set(MARKDOWN_EDITOR_NODE_TYPES);

/** Defines the input for one headless editor. */
export interface MarkdownCompilerConfig {
  /** The Lexical namespace. */
  namespace: string;
  /** The node classes that the editor registers. */
  nodes: readonly Klass<LexicalNode>[];
  /** The Markdown transformers that the editor uses. */
  transformers: Transformer[];
}

/** Defines one serialized node with optional children. */
type SerializedNode = SerializedLexicalNode & {
  children?: SerializedNode[];
};

/** Defines the serialized shapes that the unknown-node check accepts. */
export type NodeTypeSource = EditorState | SerializedEditorState;

/**
 * Creates one headless editor for the Markdown compiler.
 * The function accepts `transformers`, so one config type serves every
 * compiler call. The editor does not need the transformers until a load or a
 * read call.
 */
export function createHeadlessMarkdownEditor({
  namespace,
  nodes,
}: MarkdownCompilerConfig): LexicalEditor {
  return createHeadlessEditor({
    namespace,
    nodes,
    onError: (error) => {
      throw error;
    },
  });
}

/**
 * Replaces the editor content with one Markdown string.
 * The function clears the root, loads the canonical Markdown, and appends one
 * empty paragraph when the result has no blocks.
 */
export function loadMarkdown(
  editor: LexicalEditor,
  markdown: string,
  transformers: Transformer[],
): void {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      $convertFromMarkdownString(canonicalize(markdown), transformers);

      if (root.getChildrenSize() === 0) {
        root.append($createParagraphNode());
      }
    },
    { discrete: true },
  );
}

/**
 * Returns canonical Markdown for one editor state.
 * The function runs the export inside `editorState.read`.
 */
export function readMarkdown(
  editorState: EditorState,
  transformers: Transformer[],
): string {
  return editorState.read(() =>
    canonicalize($convertToMarkdownString(transformers)),
  );
}

/** Returns canonical Markdown for the current editor state. */
export function getMarkdown(
  editor: LexicalEditor,
  transformers: Transformer[],
): string {
  return readMarkdown(editor.getEditorState(), transformers);
}

/**
 * Compiles one Markdown string with a new headless editor.
 * The function loads the Markdown and returns the canonical Markdown string.
 * It does not return the editor state. Use `createHeadlessMarkdownEditor` and
 * `loadMarkdown` when you need the editor state.
 */
export function compileMarkdown(
  markdown: string,
  config: MarkdownCompilerConfig,
): string {
  const editor = createHeadlessMarkdownEditor(config);
  loadMarkdown(editor, markdown, config.transformers);

  return getMarkdown(editor, config.transformers);
}

/** Returns true when one source is a live editor state. */
function isEditorState(source: NodeTypeSource): source is EditorState {
  return "toJSON" in source && typeof source.toJSON === "function";
}

/** Converts one editor state or serialized state to serialized JSON. */
function toSerializedState(source: NodeTypeSource): SerializedEditorState {
  if (isEditorState(source)) {
    return source.toJSON();
  }

  return source;
}

/**
 * Counts each serialized node type that is not in
 * `MARKDOWN_EDITOR_NODE_TYPES`.
 */
function countUnknownNodeTypes(
  serializedState: SerializedEditorState,
): Map<string, number> {
  const counts = new Map<string, number>();

  function walk(node: SerializedNode): void {
    if (!SUPPORTED_NODE_TYPES.has(node.type)) {
      counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
    }

    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  walk(serializedState.root as SerializedNode);

  return counts;
}

/**
 * Returns the serialized node types that the editor cannot export.
 * The function walks the serialized JSON and returns each unknown type one
 * time.
 */
export function getUnknownNodeTypes(source: NodeTypeSource): string[] {
  return [...countUnknownNodeTypes(toSerializedState(source)).keys()];
}

/**
 * Reports each serialized node type that the editor cannot export.
 * The function records one event for each unknown type and sends the count
 * only. It does not send Markdown content.
 */
export function reportUnknownNodeTypes(source: NodeTypeSource): string[] {
  const counts = countUnknownNodeTypes(toSerializedState(source));

  for (const count of counts.values()) {
    recordEditorEvent("editor.unknown_node_export", { count });
  }

  return [...counts.keys()];
}
