/**
 * Capability model for the Markdown editor.
 *
 * The editor computes one capability set from the variant and the props. The
 * toolbar and the plugins read the set, so a control never creates a node that
 * the transformer set cannot export.
 */

import type { MarkdownVariant } from "@/components/editor/transformers.ts";

/** Defines the toolbar controls that one editor variant supports. */
export interface EditorToolbarCapabilities {
  /** Shows the block type, list, quote, and code controls. */
  block: boolean;
  /** Shows the horizontal rule control. */
  horizontalRule: boolean;
  /** Shows the image control and the image plugin. */
  image: boolean;
  /** Shows the inline format controls and the link control. */
  inline: boolean;
}

/** Defines the features that one editor variant supports. */
export interface EditorCapabilities extends EditorToolbarCapabilities {
  /** Shows the mention plugin. */
  mentions: boolean;
}

/** Defines the inputs for the capability function. */
export interface EditorCapabilityOptions {
  /** Shows an image control only when an upload handler is present. */
  hasImageUpload: boolean;
  /** Shows mentions only when a source is present and the prop allows them. */
  mentionsRequested: boolean;
  /** Hides the edit-only features when the editor is read only. */
  readOnly: boolean;
  /** The transformer set that the editor uses. */
  variant: MarkdownVariant;
}

/**
 * Returns the features for one editor.
 * The plain and compact variants keep the inline controls and hide the block
 * controls. The standard variant adds the block controls. The full variant
 * adds the horizontal rule and the image. The mention plugin needs a source,
 * an editable editor, and a variant that supports mentions.
 */
export function getEditorCapabilities({
  hasImageUpload,
  mentionsRequested,
  readOnly,
  variant,
}: EditorCapabilityOptions): EditorCapabilities {
  const block = variant === "standard" || variant === "full";
  const full = variant === "full";

  return {
    block,
    horizontalRule: full,
    image: full && hasImageUpload,
    inline: true,
    mentions: mentionsRequested && !readOnly && variant !== "plain",
  };
}
