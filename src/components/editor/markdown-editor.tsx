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
import { type Transformer } from "@lexical/markdown";
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
import { type EditorState, type EditorThemeClasses } from "lexical";

import { useTranslation } from "@/components/context/translation.tsx";
import {
  getEditorCapabilities,
  type EditorCapabilities,
} from "@/components/editor/capabilities.ts";
import {
  getMarkdown,
  loadMarkdown,
  readMarkdown,
  reportUnknownNodeTypes,
} from "@/components/editor/compiler.ts";
import { recordEditorEvent } from "@/components/editor/editor-telemetry.ts";
import { EditorToolbar } from "@/components/editor/editor-toolbar.tsx";
import {
  type ImageResolver,
  ImageResolverContext,
} from "@/components/editor/image-node.tsx";
import { ImagePlugin } from "@/components/editor/image-plugin.tsx";
import type { ImageUploadHandler } from "@/components/editor/image-upload.ts";
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
  /** The element id. A visible label can point at this id. */
  id?: string;
  /** The transformer set. The default is `"standard"`. */
  variant?: MarkdownEditorVariant;
  /** The example text for an empty editor. The placeholder is not the label. */
  placeholder?: string;
  /** The accessible name of the editable region. */
  ariaLabel?: string;
  /** The ids of the elements that describe the editable region. */
  ariaDescribedBy?: string;
  /** Marks the editable region invalid when the value is true. */
  ariaInvalid?: boolean;
  /** Blocks edits when the value is true. */
  readOnly?: boolean;
  /**
   * Shows the formatting toolbar. The default is true. The toolbar shows only
   * the controls that the variant supports. The read-only state hides it.
   */
  showToolbar?: boolean;
  /** Searches for the `@` mention targets. */
  mentionSource?: MentionSource;
  /**
   * Shows the `@` mention picker. The default is true when a source is given.
   * The picker stays off in the read-only, plain, and fallback states.
   */
  showMentions?: boolean;
  /**
   * Uploads one image and returns its stored id.
   * The image button and the image plugin appear when this value is set.
   */
  onUploadImage?: ImageUploadHandler;
  /**
   * Loads one image file for a file id.
   * A resolver takes priority over the worker file store.
   */
  resolveImageFile?: ImageResolver;
  /** The extra class names for the outer element. */
  className?: string;
}

/**
 * Throws an editor error so the nearest error boundary can handle it.
 */
function reportEditorError(error: Error): void {
  throw error;
}

/** Defines the props of the raw Markdown fallback. */
interface UnsupportedMarkdownFallbackProps {
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  className?: string;
  features: UnsupportedFeature[];
  handleRef: Ref<MarkdownEditorHandle>;
  id?: string;
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
  ariaDescribedBy,
  ariaInvalid,
  className,
  features,
  handleRef,
  id,
  onChange,
  placeholder,
  readOnly,
  value,
}: UnsupportedMarkdownFallbackProps): ReactNode {
  const { t } = useTranslation();
  const labelId = useId();
  const noticeId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const controlId = id ?? labelId;
  const describedBy =
    [ariaDescribedBy, noticeId].filter(Boolean).join(" ") || undefined;
  const feature = features[0] ?? "unknown";

  useImperativeHandle(
    handleRef,
    () => ({
      getMarkdown: () => value,
      // The parent value controls the fallback text area.
      setMarkdown: () => undefined,
      focus: () => textareaRef.current?.focus(),
    }),
    [value],
  );

  return (
    <div className={cn("markdown-editor-shell grid gap-2", className)}>
      {id === undefined ? (
        <Label
          className="text-base leading-relaxed sm:text-base"
          htmlFor={labelId}
        >
          {t("editor_fallback_label")}
        </Label>
      ) : null}
      <p
        className="text-base leading-relaxed text-muted-foreground"
        id={noticeId}
      >
        {t(getFallbackNoticeKey(feature))}
      </p>
      <Textarea
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid}
        className="markdown-editor-fallback text-base leading-relaxed sm:text-base"
        id={controlId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        ref={textareaRef}
        rows={12}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}

/** Defines the props of the inner surface that reads the composer context. */
interface EditorSurfaceProps extends MarkdownEditorProps {
  capabilities: EditorCapabilities;
  handleRef: Ref<MarkdownEditorHandle>;
  transformers: Transformer[];
}

/** Renders the editable region and the Markdown plugins. */
function EditorSurface({
  ariaDescribedBy,
  ariaInvalid,
  ariaLabel = DEFAULT_ARIA_LABEL,
  capabilities,
  className,
  handleRef,
  id,
  mentionSource,
  onChange,
  onUploadImage,
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
      loadMarkdown(editor, value, transformers);
    } finally {
      syncingRef.current = false;
    }
  }, [editor, transformers, value]);

  useImperativeHandle(
    handleRef,
    () => ({
      getMarkdown() {
        return getMarkdown(editor, transformers);
      },
      setMarkdown(markdown: string) {
        syncingRef.current = true;

        try {
          loadMarkdown(editor, markdown, transformers);
        } finally {
          syncingRef.current = false;
        }
      },
      focus() {
        editor.getRootElement()?.focus();
      },
    }),
    [editor, transformers],
  );

  function handleChange(editorState: EditorState): void {
    reportUnknownNodeTypes(editorState);
    const markdown = readMarkdown(editorState, transformers);

    if (markdown === lastEmittedRef.current) return;

    lastEmittedRef.current = markdown;
    if (syncingRef.current) return;
    onChange(markdown);
  }

  return (
    <div className={cn("markdown-editor-shell", className)}>
      {showToolbar && !readOnly ? (
        <EditorToolbar
          capabilities={capabilities}
          onUploadImage={onUploadImage}
        />
      ) : null}
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            ariaDescribedBy={ariaDescribedBy}
            ariaInvalid={ariaInvalid}
            ariaLabel={ariaLabel}
            ariaMultiline
            className="markdown-body markdown-editor"
            data-slot="markdown-editor"
            id={id}
            tabIndex={readOnly ? -1 : 0}
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
      {capabilities.horizontalRule ? <HorizontalRulePlugin /> : null}
      <LinkPlugin validateUrl={validateUrl} />
      {capabilities.block ? <ListPlugin /> : null}
      {capabilities.mentions && mentionSource !== undefined ? (
        <MentionTypeaheadPlugin enabled source={mentionSource} />
      ) : null}
      {capabilities.image && onUploadImage !== undefined ? (
        <ImagePlugin onUploadImage={onUploadImage} />
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
    ariaDescribedBy,
    ariaInvalid,
    ariaLabel = DEFAULT_ARIA_LABEL,
    className,
    id,
    mentionSource,
    onChange,
    onUploadImage,
    placeholder,
    readOnly = false,
    resolveImageFile,
    showMentions,
    showToolbar,
    value,
    variant = "standard",
  },
  ref,
): ReactNode {
  const transformers = useMemo(() => getTransformers(variant), [variant]);
  const capabilities = useMemo(
    () =>
      getEditorCapabilities({
        hasImageUpload: onUploadImage !== undefined,
        mentionsRequested:
          mentionSource !== undefined && showMentions !== false,
        readOnly,
        variant,
      }),
    [mentionSource, onUploadImage, readOnly, showMentions, variant],
  );
  const unsupportedFeatures = useMemo(
    () => getUnsupportedFeatures(value),
    [value],
  );
  const unsupportedKey = unsupportedFeatures.join(",");
  const toolbarVisible = showToolbar ?? true;

  useEffect(() => {
    if (unsupportedKey === "") return;

    // The key holds the full feature list, so one feature set records once.
    recordEditorEvent("editor.markdown.unsupported", {
      feature: unsupportedKey.split(",")[0] ?? "unknown",
    });
  }, [unsupportedKey]);

  if (unsupportedFeatures.length > 0) {
    return (
      <UnsupportedMarkdownFallback
        ariaDescribedBy={ariaDescribedBy}
        ariaInvalid={ariaInvalid}
        className={className}
        features={unsupportedFeatures}
        handleRef={ref}
        id={id}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        value={value}
      />
    );
  }

  return (
    <ImageResolverContext.Provider value={resolveImageFile}>
      <LexicalComposer
        initialConfig={{
          namespace: NAMESPACE,
          nodes: MARKDOWN_EDITOR_NODES,
          theme: EDITOR_THEME,
          editable: !readOnly,
          onError: reportEditorError,
          editorState: (editor) => {
            loadMarkdown(editor, value, transformers);
          },
        }}
      >
        <EditorSurface
          ariaDescribedBy={ariaDescribedBy}
          ariaInvalid={ariaInvalid}
          ariaLabel={ariaLabel}
          capabilities={capabilities}
          className={className}
          handleRef={ref}
          id={id}
          mentionSource={mentionSource}
          onChange={onChange}
          onUploadImage={onUploadImage}
          placeholder={placeholder}
          readOnly={readOnly}
          showToolbar={toolbarVisible}
          transformers={transformers}
          value={value}
        />
      </LexicalComposer>
    </ImageResolverContext.Provider>
  );
});
