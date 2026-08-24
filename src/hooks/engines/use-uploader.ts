import { useCallback, useEffect, useRef, useState } from "react";
import { Schema } from "effect";

export const FileStateSchema = Schema.Union(
  Schema.mutable(
    Schema.Struct({
      kind: Schema.Literal("ready"),
      id: Schema.NonEmptyString,
      name: Schema.NonEmptyString,
      blob: Schema.instanceOf(Blob),
    }),
  ),
  Schema.mutable(
    Schema.Struct({
      kind: Schema.Literal("progress"),
      id: Schema.NonEmptyString,
      progress: Schema.NonNegativeInt,
      name: Schema.NonEmptyString,
      blob: Schema.instanceOf(Blob),
    }),
  ),
  Schema.mutable(
    Schema.Struct({
      kind: Schema.Literal("error"),
      id: Schema.NonEmptyString,
      name: Schema.NonEmptyString,
      blob: Schema.instanceOf(Blob),
      error: Schema.String,
    }),
  ),
);
export type FileState = Schema.Schema.Type<typeof FileStateSchema>;
export type ReadyFileState = FileState & {
  kind: "ready";
};

export type UploaderOptions = {
  signal: AbortSignal;
  onProgress: (progress: number) => void;
  onSuccess: (newId?: string) => void;
  onError: (error: Error) => void;
};

export type Uploader = (
  name: string,
  blob: Blob,
  options: UploaderOptions,
) => Promise<void>;

export function useUploader(
  uploader: Uploader,
) {
  const [states, setFileStates] = useState<FileState[]>([]);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  const uploaderRef = useRef(uploader);
  uploaderRef.current = uploader;

  useEffect(() => {
    return () => {
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
    };
  }, []);

  const updateFileState = useCallback(
    (id: string, updater: (prev: FileState) => FileState) => {
      setFileStates((prev) =>
        prev.map((item) => (item.id === id ? updater(item) : item))
      );
    },
    [],
  );

  const startUpload = useCallback(
    (file: Extract<FileState, { kind: "progress" }>) => {
      if (controllersRef.current.has(file.id)) {
        controllersRef.current.get(file.id)?.abort();
      }

      const controller = new AbortController();
      controllersRef.current.set(file.id, controller);

      uploaderRef.current(file.name, file.blob, {
        signal: controller.signal,

        onProgress: (progress) => {
          updateFileState(file.id, (prev) => ({
            ...prev,
            kind: "progress",
            progress: Math.min(100, Math.max(0, Math.round(progress))),
          }));
        },

        onSuccess: (newId) => {
          const targetId = newId || file.id;

          setFileStates((prev) =>
            prev.map((item) =>
              item.id === file.id
                ? ({ ...item, id: targetId, kind: "ready" } as FileState)
                : item
            )
          );

          controllersRef.current.delete(file.id);
        },

        onError: (error) => {
          if (error.name === "AbortError") return;

          updateFileState(file.id, (prev) => ({
            ...prev,
            kind: "error",
            error: error.message || "Upload failed",
          }));

          controllersRef.current.delete(file.id);
        },
      }).catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Unhandled upload error:", err);
        }
      });
    },
    [updateFileState],
  );

  const add = useCallback(
    (blob: Blob, name: string): string => {
      const id = crypto.randomUUID();

      const newFileState: Extract<FileState, { kind: "progress" }> = {
        kind: "progress",
        id,
        name,
        blob,
        progress: 0,
      };

      setFileStates((prev) => [...prev, newFileState]);

      startUpload(newFileState);

      return id;
    },
    [startUpload],
  );

  const remove = useCallback((id: string) => {
    const controller = controllersRef.current.get(id);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(id);
    }
    setFileStates((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const addReady = useCallback(
    (files: ReadyFileState | ReadyFileState[]) => {
      const fileArray = Array.isArray(files) ? files : [files];
      if (fileArray.length === 0) return;

      const incomingIds = new Set(fileArray.map((f) => f.id));

      incomingIds.forEach((id) => {
        const controller = controllersRef.current.get(id);
        if (controller) {
          controller.abort();
          controllersRef.current.delete(id);
        }
      });

      setFileStates((prev) => {
        const filteredPrev = prev.filter((item) => !incomingIds.has(item.id));
        return [...filteredPrev, ...fileArray];
      });
    },
    [],
  );

  return [
    states,
    add,
    remove,
    addReady,
  ] as const;
}
