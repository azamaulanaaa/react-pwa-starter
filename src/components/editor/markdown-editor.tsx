/**
 * Markdown editor shell.
 *
 * This module uses the classic composer API: `LexicalComposer` plus plugins.
 * The extension API is newer, but the classic plugins have more examples.
 * The Markdown transformers work with both APIs. Do not mix the two APIs in
 * this module.
 */

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  type Transformer,
} from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  type EditorState,
  type EditorThemeClasses,
} from "lexical";

import { useTranslation } from "@/components/context/translation.tsx";
import { EditorToolbar } from "@/components/editor/editor-toolbar.tsx";
import { MentionTypeaheadPlugin } from "@/components/editor/mention-typeahead.tsx";
import { MARKDOWN_EDITOR_NODES } from "@/components/editor/nodes.ts";
import {
  getUnsupportedFeatures,
  type UnsupportedFeature,
} from "@/components/editor/support.ts";
import {
  getTransformers,
  type MarkdownVariant,
} from "@/components/editor/transformers.ts";
import { validateUrl } from "@/components/editor/url.ts";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import type { MentionSource } from "@/lib/mentions/index.ts";
import { canonicalize } from "@/lib/markdown/dialect.ts";
import { cn } from "@/lib/utils/cn.ts";

import "@/components/markdown/markdown.css";
import "@/components/editor/markdown-editor.css";

/** Defines the module-scope Lexical namespace. */
const NAMESPACE = "MarkdownEditor";

/** Defines the fallback accessible name for the editable region. */
const DEFAULT_ARIA_LABEL = "Markdown editor";

export { validateUrl };

/** Returns the translation key for one unsupported feature notice. */
function getFallbackNoticeKey(feature: UnsupportedFeature): string {
  if (feature === "table") return "editor_fallback_table";
  if (feature === "image") return "editor_fallback_image";
  return "editor_fallback_generic";
}

/**
 * Maps Lexical nodes to classes.
 * The shared Markdown styles supply the typography. The classes below add the
 * matching token-based colors and the code block layout.
 */
const EDITOR_THEME: EditorThemeClasses = {
  paragraph: "my-0",
  heading: {
    h1: "mt-6 mb-2 font-semibold leading-tight tracking-[-0.02em]",
    h2: "mt-6 mb-2 font-semibold leading-tight tracking-[-0.02em]",
    h3: "mt-4 mb-2 font-semibold leading-tight tracking-[-0.01em]",
    h4: "mt-4 mb-2 font-semibold leading-tight",
    h5: "mt-4 mb-2 font-semibold leading-tight",
    h6: "mt-4 mb-2 font-semibold leading-tight",
  },
  list: {
    ul: "my-0 mb-4 list-disc ps-6",
    ol: "my-0 mb-4 list-decimal ps-6",
    checklist: "list-none ps-0",
    listitem: "my-0 mt-1 first:mt-0",
    listitemChecked: "text-muted-foreground line-through",
    listitemUnchecked: "",
    nested: {
      list: "my-0 mt-1 mb-0",
      listitem: "my-0 mt-1 first:mt-0",
    },
  },
  quote: "my-0 mb-4 border-s-4 border-border ps-4 text-muted-foreground",
  code: "markdown-editor-code my-0 mb-4 block max-w-full overflow-x-auto rounded-lg border border-border bg-code p-4 font-mono text-sm leading-normal",
  link: "text-info-foreground underline underline-offset-[0.15em]",
  text: {
    bold: "font-semibold",
    italic: "italic",
    strikethrough: "line-through",
    underline: "underline",
    code: "markdown-editor-inline-code rounded-sm bg-code-highlight px-1.5 py-0.5 font-mono text-sm",
  },
};

/** Defines the value variants that the editor accepts. */
export type MarkdownEditorVariant = MarkdownVariant;

/** Defines the imperative handle of the Markdown editor. */
export interface MarkdownEditorHandle {
  /** Returns the current editor content as canonical Markdown. */
  getMarkdown(): string;
  /** Replaces the editor content with canonical Markdown. This method does not call `onChange`. */
  setMarkdown(markdown: string): void;
  /** Moves the keyboard focus to the editor. */
  focus(): void;
}

/** Defines the props of the Markdown editor. */
export interface MarkdownEditorProps {
  /** The Markdown text to show. */
  value: string;
  /** Receives the canonical Markdown after each text change. */
  onChange: (markdown: string) => void;
  /** The transformer set. The default is `"standard"`. */
  variant?: MarkdownEditorVariant;
  /** The example text for an empty editor. The placeholder is not the label. */
  placeholder?: string;
  /** The accessible name of the editable region. */
  ariaLabel?: string;
  /** Blocks edits when the value is true. */
  readOnly?: boolean;
  /**
   * Shows the formatting toolbar. The default is true for the standard and
   * full variants. The plain variant has no block commands.
   */
  showToolbar?: boolean;
  /** Searches for the `@` mention targets. */
  mentionSource?: MentionSource;
  /**
   * Shows the `@` mention picker. The default is true when a source is given.
   * The picker stays off in the read-only, plain, and fallback states.
   */
  showMentions?: boolean;
  /** The extra class names for the outer element. */
  className?: string;
}

/**
 * Throws an editor error so the nearest error boundary can handle it.
 */
function reportEditorError(error: Error): void {
  throw error;
}

/**
 * Replaces the editor content with one Markdown string.
 * The function appends an empty paragraph when the result has no blocks.
 */
function $seedEditor(markdown: string, transformers: Transformer[]): void {
  const root = $getRoot();
  root.clear();
  $convertFromMarkdownString(canonicalize(markdown), transformers);

  if (root.getChildrenSize() === 0) {
    root.append($createParagraphNode());
  }
}

/** Returns canonical Markdown for one editor state. */
function readMarkdown(
  editorState: EditorState,
  transformers: Transformer[],
): string {
  return editorState.read(() =>
    canonicalize($convertToMarkdownString(transformers)),
  );
}

/** Defines the props of the raw Markdown fallback. */
interface UnsupportedMarkdownFallbackProps {
  className?: string;
  features: UnsupportedFeature[];
  onChange: (markdown: string) => void;
  placeholder?: string;
  readOnly: boolean;
  value: string;
}

/**
 * Shows the raw Markdown when the editor cannot represent the document.
 * The component sends each edit to `onChange` without a canonicalization step.
 */
function UnsupportedMarkdownFallback({
  className,
  features,
  onChange,
  placeholder,
  readOnly,
  value,
}: UnsupportedMarkdownFallbackProps): ReactNode {
  const { t } = useTranslation();
  const labelId = useId();
  const noticeId = useId();
  const feature = features[0] ?? "unknown";

  return (
    <div className={cn("markdown-editor-shell grid gap-2", className)}>
      <Label
        className="text-base leading-relaxed sm:text-base"
        htmlFor={labelId}
      >
        {t("editor_fallback_label")}
      </Label>
      <p
        className="text-base leading-relaxed text-muted-foreground"
        id={noticeId}
      >
        {t(getFallbackNoticeKey(feature))}
      </p>
      <Textarea
        aria-describedby={noticeId}
        className="markdown-editor-fallback text-base leading-relaxed sm:text-base"
        id={labelId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        rows={12}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}

/** Defines the props of the inner surface that reads the composer context. */
interface EditorSurfaceProps extends MarkdownEditorProps {
  handleRef: Ref<MarkdownEditorHandle>;
  mentionsEnabled: boolean;
  transformers: Transformer[];
}

/** Renders the editable region and the Markdown plugins. */
function EditorSurface({
  ariaLabel = DEFAULT_ARIA_LABEL,
  className,
  handleRef,
  mentionSource,
  mentionsEnabled,
  onChange,
  placeholder,
  readOnly = false,
  showToolbar = false,
  transformers,
  value,
}: EditorSurfaceProps): ReactNode {
  const [editor] = useLexicalComposerContext();
  const previousValueRef = useRef(value);
  const lastEmittedRef = useRef(canonicalize(value));
  const syncingRef = useRef(false);

  useEffect(() => {
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (value === previousValueRef.current) return;

    previousValueRef.current = value;
    if (value === lastEmittedRef.current) return;

    syncingRef.current = true;

    try {
      editor.update(
        () => {
          $seedEditor(value, transformers);
        },
        { discrete: true },
      );
    } finally {
      syncingRef.current = false;
    }
  }, [editor, transformers, value]);

  useImperativeHandle(
    handleRef,
    () => ({
      getMarkdown() {
        return readMarkdown(editor.getEditorState(), transformers);
      },
      setMarkdown(markdown: string) {
        syncingRef.current = true;

        try {
          editor.update(
            () => {
              $seedEditor(markdown, transformers);
            },
            { discrete: true },
          );
        } finally {
          syncingRef.current = false;
        }
      },
      focus() {
        editor.focus();
      },
    }),
    [editor, transformers],
  );

  function handleChange(editorState: EditorState): void {
    const markdown = readMarkdown(editorState, transformers);

    if (markdown === lastEmittedRef.current) return;

    lastEmittedRef.current = markdown;
    if (syncingRef.current) return;
    onChange(markdown);
  }

  return (
    <div className={cn("markdown-editor-shell", className)}>
      {showToolbar && !readOnly ? <EditorToolbar /> : null}
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            ariaLabel={ariaLabel}
            ariaMultiline
            className="markdown-body markdown-editor"
            data-slot="markdown-editor"
          />
        }
        placeholder={
          placeholder === undefined ? null : (
            <div aria-hidden="true" className="markdown-editor-placeholder">
              {placeholder}
            </div>
          )
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <HorizontalRulePlugin />
      <LinkPlugin validateUrl={validateUrl} />
      <ListPlugin />
      {mentionsEnabled && mentionSource !== undefined ? (
        <MentionTypeaheadPlugin enabled source={mentionSource} />
      ) : null}
      <OnChangePlugin
        ignoreHistoryMergeTagChange={false}
        ignoreSelectionChange
        onChange={handleChange}
      />
      <MarkdownShortcutPlugin transformers={transformers} />
    </div>
  );
}

/**
 * Shows a Markdown editor and returns canonical Markdown.
 * The component does not expose Lexical JSON.
 */
export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(
  {
    ariaLabel = DEFAULT_ARIA_LABEL,
    className,
    mentionSource,
    onChange,
    placeholder,
    readOnly = false,
    showMentions,
    showToolbar,
    value,
    variant = "standard",
  },
  ref,
): ReactNode {
  const transformers = useMemo(() => getTransformers(variant), [variant]);
  const unsupportedFeatures = useMemo(
    () => getUnsupportedFeatures(value),
    [value],
  );
  const toolbarVisible = showToolbar ?? variant !== "plain";
  const mentionsEnabled =
    mentionSource !== undefined &&
    showMentions !== false &&
    !readOnly &&
    variant !== "plain";

  if (unsupportedFeatures.length > 0) {
    return (
      <UnsupportedMarkdownFallback
        className={className}
        features={unsupportedFeatures}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        value={value}
      />
    );
  }

  return (
    <LexicalComposer
      initialConfig={{
        namespace: NAMESPACE,
        nodes: MARKDOWN_EDITOR_NODES,
        theme: EDITOR_THEME,
        editable: !readOnly,
        onError: reportEditorError,
        editorState: () => {
          $seedEditor(value, transformers);
        },
      }}
    >
      <EditorSurface
        ariaLabel={ariaLabel}
        className={className}
        handleRef={ref}
        mentionSource={mentionSource}
        mentionsEnabled={mentionsEnabled}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        showToolbar={toolbarVisible}
        transformers={transformers}
        value={value}
      />
    </LexicalComposer>
  );
});
