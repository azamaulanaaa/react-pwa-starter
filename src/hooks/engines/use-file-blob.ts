import { useEffect, useState } from "react";

import { useWorker } from "@/components/context/worker.tsx";

/** Defines the file state that the hook shows. */
export type FileBlobState =
  | { status: "loading"; url: null }
  | { status: "ready"; url: string }
  | { status: "missing"; url: null }
  | { status: "error"; url: null };

/**
 * Loads one file blob from the worker file store.
 * The hook creates one object URL and revokes it when the file id changes.
 * The hook stops the state update after the component closes.
 */
export function useFileBlob(fileId: string | null): FileBlobState {
  const worker = useWorker();
  const [state, setState] = useState<FileBlobState>(
    fileId === null
      ? { status: "missing", url: null }
      : { status: "loading", url: null },
  );

  useEffect(() => {
    if (fileId === null) {
      setState({ status: "missing", url: null });
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: "loading", url: null });

    worker.fs
      .Get(fileId)
      .then((file) => {
        if (file === null) {
          if (!cancelled) setState({ status: "missing", url: null });
          return;
        }

        objectUrl = URL.createObjectURL(file.blob);

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
  }, [fileId, worker]);

  return state;
}
