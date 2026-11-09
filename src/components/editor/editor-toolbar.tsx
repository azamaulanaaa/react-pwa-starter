/**
 * Formatting toolbar for the Markdown editor.
 *
 * The toolbar sends Lexical commands to the editor that owns it. It reads and
 * writes Markdown only through that editor, never through Lexical JSON.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { $createCodeNode, $isCodeNode } from "@lexical/code";
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  type ListType,
} from "@lexical/list";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type ElementNode,
  type LexicalCommand,
  type LexicalNode,
  type TextFormatType,
} from "lexical";
import {
  BoldIcon,
  CircleAlertIcon,
  CodeIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  Redo2Icon,
  SquareCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";

import { useTranslation } from "@/components/context/translation.tsx";
import { INSERT_IMAGE_COMMAND } from "@/components/editor/image-plugin.tsx";
import type { ImageUploadHandler } from "@/components/editor/image-upload.ts";
import { useRovingTabindex } from "@/components/editor/use-roving-tabindex.ts";
import { validateUrl } from "@/components/editor/url.ts";
import { Button } from "@/components/ui/button.tsx";
import { Field, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Popover,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Toggle } from "@/components/ui/toggle.tsx";
import { cn } from "@/lib/utils/cn.ts";

/** Defines the block types that the block select offers. */
type BlockType = "paragraph" | "h1" | "h2" | "h3";

/** Defines the text formats that the toolbar can toggle. */
type TextFormat = "bold" | "italic" | "underline" | "strikethrough" | "code";

/** Lists the toolbar control positions in the roving tab order. */
const ITEM = {
  block: 7,
  blockquote: 11,
  bold: 2,
  bulletList: 8,
  checkList: 10,
  codeBlock: 12,
  horizontalRule: 15,
  image: 13,
  inlineCode: 6,
  italic: 3,
  link: 14,
  orderedList: 9,
  redo: 1,
  strikethrough: 5,
  underline: 4,
  undo: 0,
} as const;

/** Defines the toolbar state that one editor selection reports. */
interface ToolbarState {
  block: BlockType;
  canRedo: boolean;
  canUndo: boolean;
  formats: Record<TextFormat, boolean>;
  hasSelection: boolean;
  isCodeBlock: boolean;
  isLink: boolean;
  isQuote: boolean;
  linkUrl: string | null;
  list: ListType | null;
}

const EMPTY_FORMATS: Record<TextFormat, boolean> = {
  bold: false,
  code: false,
  italic: false,
  strikethrough: false,
  underline: false,
};

const EMPTY_STATE: ToolbarState = {
  block: "paragraph",
  canRedo: false,
  canUndo: false,
  formats: EMPTY_FORMATS,
  hasSelection: false,
  isCodeBlock: false,
  isLink: false,
  isQuote: false,
  linkUrl: null,
  list: null,
};

/** Returns the root child element that holds one node. */
function $getTopLevelNode(node: LexicalNode): ElementNode | null {
  let current: LexicalNode | null = node;

  while (current !== null && current.getParent() !== $getRoot()) {
    current = current.getParent();
  }

  return current !== null && $isElementNode(current) ? current : null;
}

/** Returns the block type for one heading tag, or paragraph for other tags. */
function getHeadingBlockType(tag: string): BlockType {
  if (tag === "h1") return "h1";
  if (tag === "h2") return "h2";
  if (tag === "h3") return "h3";
  return "paragraph";
}

/** Returns true when one string is a block type that the select offers. */
function isBlockType(value: string): value is BlockType {
  return (
    value === "paragraph" || value === "h1" || value === "h2" || value === "h3"
  );
}

/** Defines the link popover state. */
interface LinkFormState {
  error: string | null;
  open: boolean;
  value: string;
}

const LINK_FORM_CLOSED: LinkFormState = {
  error: null,
  open: false,
  value: "",
};

/** Defines the props of the formatting toolbar. */
export interface EditorToolbarProps {
  /** Enables the image button when the editor has an upload handler. */
  onUploadImage?: ImageUploadHandler;
}

/**
 * Shows the formatting toolbar for the current Lexical editor.
 * The toolbar must render inside `LexicalComposer`.
 */
export function EditorToolbar({
  onUploadImage,
}: EditorToolbarProps): ReactNode {
  const { t } = useTranslation();
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState<ToolbarState>(EMPTY_STATE);
  const [linkForm, setLinkForm] = useState<LinkFormState>(LINK_FORM_CLOSED);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const roving = useRovingTabindex();
  const linkInputId = useId();
  const linkErrorId = useId();

  useEffect(() => {
    const syncState = (): void => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection)) {
        setState((previous) => ({
          ...EMPTY_STATE,
          canRedo: previous.canRedo,
          canUndo: previous.canUndo,
        }));
        return;
      }

      const topLevel = $getTopLevelNode(selection.anchor.getNode());
      const link = $findMatchingParent(selection.anchor.getNode(), $isLinkNode);
      const linkUrl = link?.getURL() ?? null;
      const formats: Record<TextFormat, boolean> = {
        bold: selection.hasFormat("bold"),
        code: selection.hasFormat("code"),
        italic: selection.hasFormat("italic"),
        strikethrough: selection.hasFormat("strikethrough"),
        underline: selection.hasFormat("underline"),
      };
      let block: BlockType = "paragraph";
      let isCodeBlock = false;
      let isQuote = false;
      let list: ListType | null = null;

      if (topLevel !== null) {
        if ($isHeadingNode(topLevel)) {
          block = getHeadingBlockType(topLevel.getTag());
        } else if ($isQuoteNode(topLevel)) {
          isQuote = true;
        } else if ($isCodeNode(topLevel)) {
          isCodeBlock = true;
        } else if ($isListNode(topLevel)) {
          list = topLevel.getListType();
        }
      }

      setState((previous) => ({
        block,
        canRedo: previous.canRedo,
        canUndo: previous.canUndo,
        formats,
        hasSelection: !selection.isCollapsed(),
        isCodeBlock,
        isLink: link !== null,
        isQuote,
        linkUrl,
        list,
      }));
    };

    const unregister = mergeRegister(
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (canUndo) => {
          setState((previous) => ({ ...previous, canUndo }));
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (canRedo) => {
          setState((previous) => ({ ...previous, canRedo }));
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          editor.getEditorState().read(syncState);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
    const unregisterUpdates = editor.registerUpdateListener(
      ({ editorState }) => {
        editorState.read(syncState);
      },
    );

    editor.getEditorState().read(syncState);

    return () => {
      unregister();
      unregisterUpdates();
    };
  }, [editor]);

  function runCommand<T>(command: LexicalCommand<T>, payload: T): void {
    editor.update(
      () => {
        editor.dispatchCommand(command, payload);
      },
      { discrete: true },
    );
  }

  function toggleFormat(format: TextFormatType): void {
    runCommand(FORMAT_TEXT_COMMAND, format);
  }

  function applyBlockType(value: string | null): void {
    if (value === null || !isBlockType(value)) return;

    editor.update(
      () => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) return;

        if (value === "paragraph") {
          $setBlocksType(selection, () => $createParagraphNode());
          return;
        }

        $setBlocksType(selection, () => $createHeadingNode(value));
      },
      { discrete: true },
    );
  }

  function toggleBlockquote(): void {
    const nextIsQuote = !state.isQuote;

    editor.update(
      () => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) return;

        $setBlocksType(selection, () =>
          nextIsQuote ? $createQuoteNode() : $createParagraphNode(),
        );
      },
      { discrete: true },
    );
  }

  function toggleCodeBlock(): void {
    const nextIsCodeBlock = !state.isCodeBlock;

    editor.update(
      () => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) return;

        $setBlocksType(selection, () =>
          nextIsCodeBlock ? $createCodeNode() : $createParagraphNode(),
        );
      },
      { discrete: true },
    );
  }

  function toggleList(type: ListType): void {
    if (state.list === type) {
      runCommand(REMOVE_LIST_COMMAND, undefined);
      return;
    }

    if (type === "bullet") {
      runCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      return;
    }

    if (type === "number") {
      runCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      return;
    }

    runCommand(INSERT_CHECK_LIST_COMMAND, undefined);
  }

  function handleLinkOpenChange(open: boolean): void {
    if (open) {
      setLinkForm({ error: null, open: true, value: state.linkUrl ?? "" });
      return;
    }

    setLinkForm(LINK_FORM_CLOSED);
  }

  function applyLink(): void {
    const url = linkForm.value.trim();

    if (!validateUrl(url)) {
      setLinkForm((previous) => ({
        ...previous,
        error: t("editor_toolbar_link_error"),
      }));
      linkInputRef.current?.focus();
      return;
    }

    runCommand(TOGGLE_LINK_COMMAND, url);
    setLinkForm(LINK_FORM_CLOSED);
  }

  function removeLink(): void {
    runCommand(TOGGLE_LINK_COMMAND, null);
    setLinkForm(LINK_FORM_CLOSED);
  }

  const linkLabel = state.isLink
    ? t("editor_toolbar_link_edit")
    : t("editor_toolbar_link_add");
  const blockLabels: Record<BlockType, string> = {
    h1: t("editor_toolbar_heading_1"),
    h2: t("editor_toolbar_heading_2"),
    h3: t("editor_toolbar_heading_3"),
    paragraph: t("editor_toolbar_paragraph"),
  };

  return (
    <div
      aria-label={t("editor_toolbar_label")}
      aria-orientation="horizontal"
      className="markdown-editor-toolbar mb-2 flex min-w-0 flex-wrap items-center gap-1 rounded-lg border bg-card p-1 text-card-foreground"
      onFocus={roving.onFocus}
      onKeyDown={roving.onKeyDown}
      onMouseDown={(event) => event.preventDefault()}
      ref={roving.containerRef}
      role="toolbar"
    >
      <div
        aria-label={t("editor_toolbar_history")}
        className="flex items-center gap-0.5"
        role="group"
      >
        <Button
          aria-label={t("editor_toolbar_undo")}
          disabled={!state.canUndo}
          size="icon"
          variant="ghost"
          {...roving.getItemProps(ITEM.undo)}
          onClick={() => runCommand(UNDO_COMMAND, undefined)}
        >
          <Undo2Icon aria-hidden="true" />
        </Button>
        <Button
          aria-label={t("editor_toolbar_redo")}
          disabled={!state.canRedo}
          size="icon"
          variant="ghost"
          {...roving.getItemProps(ITEM.redo)}
          onClick={() => runCommand(REDO_COMMAND, undefined)}
        >
          <Redo2Icon aria-hidden="true" />
        </Button>
      </div>

      <Separator className="mx-0.5 h-6" orientation="vertical" />

      <div
        aria-label={t("editor_toolbar_format")}
        className="flex flex-wrap items-center gap-0.5"
        role="group"
      >
        <Toggle
          aria-label={t("editor_toolbar_bold")}
          onPressedChange={() => toggleFormat("bold")}
          pressed={state.formats.bold}
          {...roving.getItemProps(ITEM.bold)}
        >
          <BoldIcon aria-hidden="true" />
        </Toggle>
        <Toggle
          aria-label={t("editor_toolbar_italic")}
          onPressedChange={() => toggleFormat("italic")}
          pressed={state.formats.italic}
          {...roving.getItemProps(ITEM.italic)}
        >
          <ItalicIcon aria-hidden="true" />
        </Toggle>
        <Toggle
          aria-label={t("editor_toolbar_underline")}
          onPressedChange={() => toggleFormat("underline")}
          pressed={state.formats.underline}
          {...roving.getItemProps(ITEM.underline)}
        >
          <UnderlineIcon aria-hidden="true" />
        </Toggle>
        <Toggle
          aria-label={t("editor_toolbar_strikethrough")}
          onPressedChange={() => toggleFormat("strikethrough")}
          pressed={state.formats.strikethrough}
          {...roving.getItemProps(ITEM.strikethrough)}
        >
          <StrikethroughIcon aria-hidden="true" />
        </Toggle>
        <Toggle
          aria-label={t("editor_toolbar_inline_code")}
          onPressedChange={() => toggleFormat("code")}
          pressed={state.formats.code}
          {...roving.getItemProps(ITEM.inlineCode)}
        >
          <CodeIcon aria-hidden="true" />
        </Toggle>
      </div>

      <Separator className="mx-0.5 h-6" orientation="vertical" />

      <div
        aria-label={t("editor_toolbar_block_type")}
        className="flex items-center"
        role="group"
      >
        <Select
          items={blockLabels}
          onValueChange={applyBlockType}
          value={state.block}
        >
          <SelectTrigger
            aria-label={t("editor_toolbar_block_type")}
            className="min-w-0"
            size="sm"
            {...roving.getItemProps(ITEM.block)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="paragraph">{blockLabels.paragraph}</SelectItem>
            <SelectItem value="h1">{blockLabels.h1}</SelectItem>
            <SelectItem value="h2">{blockLabels.h2}</SelectItem>
            <SelectItem value="h3">{blockLabels.h3}</SelectItem>
          </SelectPopup>
        </Select>
      </div>

      <Separator className="mx-0.5 h-6" orientation="vertical" />

      <div
        aria-label={t("editor_toolbar_list")}
        className="flex flex-wrap items-center gap-0.5"
        role="group"
      >
        <Toggle
          aria-label={t("editor_toolbar_bullet_list")}
          onPressedChange={() => toggleList("bullet")}
          pressed={state.list === "bullet"}
          {...roving.getItemProps(ITEM.bulletList)}
        >
          <ListIcon aria-hidden="true" />
        </Toggle>
        <Toggle
          aria-label={t("editor_toolbar_ordered_list")}
          onPressedChange={() => toggleList("number")}
          pressed={state.list === "number"}
          {...roving.getItemProps(ITEM.orderedList)}
        >
          <ListOrderedIcon aria-hidden="true" />
        </Toggle>
        <Toggle
          aria-label={t("editor_toolbar_check_list")}
          onPressedChange={() => toggleList("check")}
          pressed={state.list === "check"}
          {...roving.getItemProps(ITEM.checkList)}
        >
          <ListChecksIcon aria-hidden="true" />
        </Toggle>
      </div>

      <Separator className="mx-0.5 h-6" orientation="vertical" />

      <div
        aria-label={t("editor_toolbar_insert")}
        className="flex flex-wrap items-center gap-0.5"
        role="group"
      >
        <Toggle
          aria-label={t("editor_toolbar_blockquote")}
          onPressedChange={toggleBlockquote}
          pressed={state.isQuote}
          {...roving.getItemProps(ITEM.blockquote)}
        >
          <QuoteIcon aria-hidden="true" />
        </Toggle>
        <Toggle
          aria-label={t("editor_toolbar_code_block")}
          onPressedChange={toggleCodeBlock}
          pressed={state.isCodeBlock}
          {...roving.getItemProps(ITEM.codeBlock)}
        >
          <SquareCodeIcon aria-hidden="true" />
        </Toggle>
        <Button
          aria-label={t("editor_image_button")}
          disabled={onUploadImage === undefined}
          size="icon"
          variant="ghost"
          {...roving.getItemProps(ITEM.image)}
          onClick={() => runCommand(INSERT_IMAGE_COMMAND, undefined)}
        >
          <ImageIcon aria-hidden="true" />
        </Button>
        <Popover onOpenChange={handleLinkOpenChange} open={linkForm.open}>
          <PopoverTrigger
            aria-label={linkLabel}
            render={
              <Button
                className={cn(state.isLink && "bg-accent")}
                disabled={!state.hasSelection}
                size="icon"
                variant="ghost"
              />
            }
            {...roving.getItemProps(ITEM.link)}
          >
            <LinkIcon aria-hidden="true" />
          </PopoverTrigger>
          <PopoverPopup align="start" initialFocus={linkInputRef} side="bottom">
            <form
              className="markdown-editor-link-popover flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                applyLink();
              }}
            >
              <PopoverTitle>{linkLabel}</PopoverTitle>
              <Field>
                <FieldLabel htmlFor={linkInputId}>
                  {t("editor_toolbar_link_label")}
                </FieldLabel>
                <Input
                  aria-describedby={linkForm.error ? linkErrorId : undefined}
                  aria-invalid={linkForm.error ? true : undefined}
                  autoComplete="url"
                  id={linkInputId}
                  inputMode="url"
                  name="linkUrl"
                  onChange={(event) =>
                    setLinkForm((previous) => ({
                      ...previous,
                      error: null,
                      value: event.target.value,
                    }))
                  }
                  placeholder={t("editor_toolbar_link_placeholder")}
                  ref={linkInputRef}
                  type="url"
                  value={linkForm.value}
                />
                <p
                  aria-atomic="true"
                  className={cn(
                    "flex items-start gap-1 text-destructive-foreground text-xs",
                    linkForm.error === null && "sr-only",
                  )}
                  id={linkErrorId}
                  role="alert"
                >
                  {linkForm.error === null ? null : (
                    <>
                      <CircleAlertIcon
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0"
                      />
                      {linkForm.error}
                    </>
                  )}
                </p>
              </Field>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  disabled={!state.isLink}
                  onClick={removeLink}
                  type="button"
                  variant="outline"
                >
                  {t("editor_toolbar_link_remove")}
                </Button>
                <Button type="submit">{t("editor_toolbar_link_apply")}</Button>
              </div>
            </form>
          </PopoverPopup>
        </Popover>
        <Button
          aria-label={t("editor_toolbar_horizontal_rule")}
          size="icon"
          variant="ghost"
          {...roving.getItemProps(ITEM.horizontalRule)}
          onClick={() => runCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)}
        >
          <MinusIcon aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
