/**
 * Shows an `@` mention picker for the Markdown editor.
 *
 * The picker stores a normal Markdown link. A user selects a user or a page,
 * and the editor inserts a link such as `[Alice](/users/alex-morgan)`. The chip
 * is a CSS treatment over that link. This module does not add a custom node.
 */

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { $createLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
  type MenuRenderFn,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  type TextNode,
} from "lexical";
import { CheckIcon } from "lucide-react";

import { useTranslation } from "@/components/context/translation.tsx";
import { recordEditorEvent } from "@/components/editor/editor-telemetry.ts";
import {
  mentionHref,
  type MentionSource,
  type MentionTarget,
} from "@/lib/mentions/index.ts";

/** Defines the delay before one search starts. */
const SEARCH_DELAY_MS = 100;

/** Defines the search states that the menu can show. */
type MentionSearchStatus = "idle" | "loading" | "ready" | "error";

/** Describes one selectable mention. */
export class MentionOption extends MenuOption {
  /** The target that the option inserts. */
  target: MentionTarget;

  constructor(target: MentionTarget) {
    super(`${target.kind}:${target.id}`);
    this.target = target;
  }
}

/** Defines the props of the mention typeahead plugin. */
export interface MentionTypeaheadPluginProps {
  /** Searches for the mention targets. */
  source: MentionSource;
  /** Turns the picker on or off. The default is true. */
  enabled?: boolean;
}

/** Returns true when one error is an abort error. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/** Defines the props of the mention menu. */
interface MentionMenuProps {
  anchorElementRef: RefObject<HTMLElement | null>;
  options: MentionOption[];
  selectedIndex: number | null;
  selectOptionAndCleanUp: (option: MentionOption) => void;
  setHighlightedIndex: (index: number) => void;
  status: MentionSearchStatus;
}

/** Shows the listbox, the empty state, or the error state. */
function MentionMenu({
  anchorElementRef,
  options,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
  status,
}: MentionMenuProps): ReactNode {
  const { t } = useTranslation();
  const anchor = anchorElementRef.current;
  const message =
    status === "error"
      ? t("editor_mentions_error")
      : status === "ready" && options.length === 0
        ? t("editor_mentions_empty")
        : null;

  useEffect(() => {
    if (anchor === null) return;

    // Lexical marks the anchor as a listbox. The menu supplies the real
    // listbox, so the anchor keeps only its positioning role.
    anchor.removeAttribute("role");
    anchor.removeAttribute("aria-label");
  });

  useEffect(() => {
    if (selectedIndex === null) return;

    options[selectedIndex]?.ref?.current?.scrollIntoView({ block: "nearest" });
  }, [options, selectedIndex]);

  if (anchor === null) return null;

  // Keep the search pause free of an empty panel. The status region stays so
  // the empty and error messages can still be announced.
  if (options.length === 0 && status !== "ready" && status !== "error") {
    return createPortal(<p className="sr-only" role="status" />, anchor);
  }

  return createPortal(
    <div className="mention-typeahead-menu">
      <p
        className={message === null ? "sr-only" : "mention-typeahead-message"}
        data-state={status === "error" ? "error" : undefined}
        role="status"
      >
        {message ?? ""}
      </p>
      {options.length > 0 ? (
        <ul
          aria-label={t("editor_mentions_label")}
          className="mention-typeahead-list"
          role="listbox"
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex;

            return (
              <li
                aria-selected={selected}
                className="mention-typeahead-option"
                id={`typeahead-item-${index}`}
                key={option.key}
                onClick={() => selectOptionAndCleanUp(option)}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                ref={option.setRefElement}
                role="option"
              >
                <span className="mention-typeahead-option-text">
                  <span className="mention-typeahead-option-label">
                    {option.target.label}
                  </span>
                  {option.target.description === undefined ? null : (
                    <span className="mention-typeahead-option-description">
                      {option.target.description}
                    </span>
                  )}
                </span>
                {selected ? (
                  <CheckIcon
                    aria-hidden="true"
                    className="mention-typeahead-check"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>,
    anchor,
  );
}

/**
 * Adds the `@` mention picker to the current editor.
 * The plugin searches after a 100 ms pause. A new query aborts the old search.
 */
export function MentionTypeaheadPlugin({
  enabled = true,
  source,
}: MentionTypeaheadPluginProps): ReactNode {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const [options, setOptions] = useState<MentionOption[]>([]);
  const [status, setStatus] = useState<MentionSearchStatus>("idle");
  const triggerFn = useBasicTypeaheadTriggerMatch("@", { minLength: 0 });

  const onQueryChange = useCallback((nextQuery: string | null) => {
    setQuery(nextQuery);
  }, []);

  useEffect(() => {
    if (query === null) {
      setOptions([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();

    setOptions([]);
    setStatus("loading");

    const timer = window.setTimeout(() => {
      void source.search(query, controller.signal).then(
        (targets) => {
          if (controller.signal.aborted) return;

          setOptions(targets.map((target) => new MentionOption(target)));
          setStatus("ready");
        },
        (error: unknown) => {
          if (controller.signal.aborted || isAbortError(error)) return;

          recordEditorEvent("editor.mention.search_failed", {
            reason: "search",
          });
          setOptions([]);
          setStatus("error");
        },
      );
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, source]);

  const onSelectOption = useCallback(
    (
      option: MentionOption,
      textNodeContainingQuery: TextNode | null,
      closeMenu: () => void,
    ): void => {
      const link = $createLinkNode(mentionHref(option.target));

      link.append($createTextNode(option.target.label));

      if (textNodeContainingQuery !== null) {
        textNodeContainingQuery.replace(link);
      } else {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          selection.insertNodes([link]);
        }
      }

      closeMenu();
      editor.focus();
    },
    [editor],
  );

  const renderMenu: MenuRenderFn<MentionOption> = useCallback(
    (anchorElementRef, itemProps) => {
      if (anchorElementRef.current === null) return null;

      return (
        <MentionMenu
          anchorElementRef={anchorElementRef}
          options={itemProps.options}
          selectOptionAndCleanUp={itemProps.selectOptionAndCleanUp}
          selectedIndex={itemProps.selectedIndex}
          setHighlightedIndex={itemProps.setHighlightedIndex}
          status={status}
        />
      );
    },
    [status],
  );

  if (!enabled) return null;

  return (
    <LexicalTypeaheadMenuPlugin<MentionOption>
      menuRenderFn={renderMenu}
      onQueryChange={onQueryChange}
      onSelectOption={onSelectOption}
      options={options}
      triggerFn={triggerFn}
    />
  );
}
