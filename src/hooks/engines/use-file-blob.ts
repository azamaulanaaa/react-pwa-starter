import { useEffect, useState } from "react";

import { useOptionalWorker } from "@/components/context/worker.tsx";

/** Defines the file state that the hook shows. */
export type FileBlobState =
  | { status: "loading"; url: null }
  | { status: "ready"; url: string }
  | { status: "missing"; url: null }
  | { status: "error"; url: null };

/** Loads one file blob for a file id. */
export type FileBlobResolver = (fileId: string) => Promise<Blob | null>;

/**
 * Loads one file blob from the worker file store or from a resolver.
 * The hook creates one object URL and revokes it when the file id changes.
 * The hook stops the state update after the component closes.
 */
export function useFileBlob(
  fileId: string | null,
  resolveFile?: FileBlobResolver,
): FileBlobState {
  const worker = useOptionalWorker();
  const hasSource = resolveFile !== undefined || worker !== null;
  const [state, setState] = useState<FileBlobState>(
    fileId === null || !hasSource
      ? { status: "missing", url: null }
      : { status: "loading", url: null },
  );

  useEffect(() => {
    if (fileId === null || (resolveFile === undefined && worker === null)) {
      setState({ status: "missing", url: null });
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: "loading", url: null });

    let request: Promise<Blob | null>;

    if (resolveFile !== undefined) {
      request = resolveFile(fileId);
    } else if (worker !== null) {
      request = worker.fs
        .Get(fileId)
        .then((file) => (file === null ? null : file.blob));
    } else {
      setState({ status: "missing", url: null });
      return;
    }

    request
      .then((blob) => {
        if (blob === null) {
          if (!cancelled) setState({ status: "missing", url: null });
          return;
        }

        objectUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }

        setState({ status: "ready", url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", url: null });
      });

    return () => {
      cancelled = true;

      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
  }, [fileId, resolveFile, worker]);

  return state;
}
