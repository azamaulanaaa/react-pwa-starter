/**
 * Upload bridge for the editor image node.
 *
 * The plugin receives an `ImageUploadHandler`. The worker helper below turns
 * the worker upload stream into that handler. The plugin never calls the
 * worker directly.
 */

/** Defines the values that one image upload reports. */
export interface ImageUploadOptions {
  /** Stops the upload when the editor closes or the user cancels. */
  signal: AbortSignal;
  /** Receives the upload percent after each part. */
  onProgress: (percent: number) => void;
}

/** Defines the result of one image upload. */
export interface ImageUploadResult {
  /** The stored file id. */
  id: string;
  /** The alternative text. The value is optional. */
  alt?: string;
}

/** Uploads one image and returns its file id. */
export type ImageUploadHandler = (
  file: File,
  options: ImageUploadOptions,
) => Promise<ImageUploadResult>;

/** Defines one upload event from the worker stream. */
export interface ImageUploadEvent {
  _tag: "Init" | "Progress" | "Complete" | "Error";
  fileId?: string;
  message?: string;
  percent?: number;
}

/** Defines the worker part that the upload helper needs. */
export interface ImageUploadWorker {
  fs: {
    Upload(
      name: string,
      blob: Blob,
    ):
      | ReadableStream<ImageUploadEvent>
      | Promise<ReadableStream<ImageUploadEvent>>;
  };
}

/** Stops one upload with an abort error. */
function abortError(): DOMException {
  return new DOMException("The image upload stopped.", "AbortError");
}

/**
 * Wraps one worker file store as an image upload handler.
 * The helper reads `Init`, `Progress`, and `Complete` events.
 */
export function createWorkerImageUpload(
  worker: ImageUploadWorker,
): ImageUploadHandler {
  return async function uploadImage(file, { onProgress, signal }) {
    if (signal.aborted) throw abortError();

    const stream = await worker.fs.Upload(file.name, file);
    const reader = stream.getReader();
    let fileId: string | null = null;
    let complete = false;

    const cancel = (): void => {
      void reader.cancel().catch(() => undefined);
    };

    signal.addEventListener("abort", cancel, { once: true });

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (signal.aborted) throw abortError();
        if (done) break;

        if (value._tag === "Init") {
          fileId = value.fileId ?? null;
          continue;
        }

        if (value._tag === "Progress") {
          if (typeof value.percent === "number") onProgress(value.percent);
          continue;
        }

        if (value._tag === "Error") {
          throw new Error(value.message ?? "The image upload failed.");
        }

        if (value._tag === "Complete") {
          if (value.fileId === undefined) {
            throw new Error("The image upload did not return a file id.");
          }

          complete = true;
          fileId = value.fileId;
          break;
        }
      }

      if (signal.aborted) throw abortError();
      if (!complete || fileId === null) {
        throw new Error("The image upload ended before it completed.");
      }

      return { alt: file.name, id: fileId };
    } finally {
      signal.removeEventListener("abort", cancel);
      reader.releaseLock();
    }
  };
}
