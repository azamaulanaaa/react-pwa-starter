/**
 * Image plugin for the Markdown editor.
 *
 * The toolbar sends `INSERT_IMAGE_COMMAND`. The plugin opens a file picker and
 * sends the file to the injected upload handler. The plugin never calls the
 * worker directly.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalEditor,
} from "lexical";

import { useTranslation } from "@/components/context/translation.tsx";
import { recordEditorEvent } from "@/components/editor/editor-telemetry.ts";
import { $createImageNode } from "@/components/editor/image-node.tsx";
import type { ImageUploadHandler } from "@/components/editor/image-upload.ts";

/** Sends the command to insert one image. */
export const INSERT_IMAGE_COMMAND = createCommand<void>("INSERT_IMAGE_COMMAND");

/** Defines the status that the plugin shows. */
type ImageUploadStatus = "idle" | "uploading" | "error";

/** Defines the props of the image plugin. */
export interface ImagePluginProps {
  /** Uploads one file and returns its stored id. */
  onUploadImage: ImageUploadHandler;
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

/** Returns a coarse reason for one upload failure. */
function getUploadFailureReason(
  error: unknown,
): "network" | "worker" | "unknown" {
  if (error instanceof TypeError) return "network";
  if (error instanceof Error) return "worker";
  return "unknown";
}

/** Inserts one image node at the current selection. */
function insertImage(editor: LexicalEditor, src: string, alt: string): void {
  editor.update(
    () => {
      const paragraph = $createParagraphNode();

      paragraph.append($createImageNode({ alt, src, title: "" }));
      $insertNodes([paragraph]);
    },
    { discrete: true },
  );
}

/**
 * Adds the image command and the file picker to the current editor.
 * The status region stays mounted, so a screen reader announces each change.
 */
export function ImagePlugin({ onUploadImage }: ImagePluginProps): ReactElement {
  const { t } = useTranslation();
  const [editor] = useLexicalComposerContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<ImageUploadStatus>("idle");
  const inputId = useId();

  useEffect(() => {
    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      () => {
        inputRef.current?.click();
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const input = inputRef.current;

    if (input === null) return;

    function handleCancel(): void {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setStatus("idle");
    }

    input.addEventListener("cancel", handleCancel);

    return () => input.removeEventListener("cancel", handleCancel);
  }, []);

  async function handleUpload(file: File): Promise<void> {
    controllerRef.current?.abort();

    const controller = new AbortController();

    controllerRef.current = controller;
    setStatus("uploading");

    try {
      const result = await onUploadImage(file, {
        signal: controller.signal,
        // The status text stays constant, so the screen reader announces it once.
        onProgress: () => undefined,
      });

      if (controller.signal.aborted || controllerRef.current !== controller) {
        return;
      }

      insertImage(editor, `/fs/${result.id}`, result.alt ?? file.name);
      setStatus("idle");
    } catch (error) {
      if (controllerRef.current !== controller) return;

      if (controller.signal.aborted || isAbortError(error)) {
        setStatus("idle");
        return;
      }

      recordEditorEvent("editor.upload.failed", {
        reason: getUploadFailureReason(error),
      });
      setStatus("error");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (file === undefined) return;

    void handleUpload(file);
  }

  const message =
    status === "uploading"
      ? t("editor_image_uploading")
      : status === "error"
        ? t("editor_image_error")
        : "";

  return (
    <>
      <label className="sr-only" htmlFor={inputId}>
        {t("editor_image_file_label")}
      </label>
      <input
        accept="image/*"
        aria-label={t("editor_image_file_label")}
        className="sr-only"
        id={inputId}
        name="imageFile"
        onChange={handleChange}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
      <p
        aria-atomic="true"
        className="image-upload-status"
        data-state={status}
        role="status"
      >
        {message}
      </p>
    </>
  );
}
