import { useCallback, useMemo, useRef, useState } from "react";

import { useWorker } from "@/components/context/worker.tsx";
import { useReadableStreams } from "@/hooks/primitives/use-readable-stream.ts";
import type { Job } from "@/worker/queue/schema.ts";

export type QueueActionResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "error"; error: Error };

export interface QueueActionTarget {
  id: string;
  action: "pause" | "resume" | "cancel";
}

export interface UseQueueJobsResult {
  jobs: Job[];
  loading: boolean;
  error: Error | null;
  pendingAction: QueueActionTarget | null;
  refresh: () => Promise<void>;
  pause: (id: string) => Promise<QueueActionResult>;
  resume: (id: string) => Promise<QueueActionResult>;
  cancel: (id: string) => Promise<QueueActionResult>;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Returns the queue jobs and the per-job actions.
 * The worker stream sends the first snapshot and each later change.
 */
export function useQueueJobs(): UseQueueJobsResult {
  const worker = useWorker();
  const factory = useRef(() => worker.queue.watch());
  const [refreshKey, setRefreshKey] = useState(0);
  const params = useMemo(() => [refreshKey], [refreshKey]);
  const streams = useReadableStreams(factory.current, params);
  const streamState = streams.get(refreshKey);

  const [pendingAction, setPendingAction] = useState<QueueActionTarget | null>(
    null,
  );

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshKey((key) => key + 1);
  }, []);

  const runAction = useCallback(
    async (
      id: string,
      action: QueueActionTarget["action"],
    ): Promise<QueueActionResult> => {
      setPendingAction({ id, action });

      try {
        let accepted = false;

        if (action === "pause") accepted = await worker.queue.pause(id);
        if (action === "resume") accepted = await worker.queue.resume(id);
        if (action === "cancel") accepted = await worker.queue.cancel(id);

        return accepted ? { ok: true } : { ok: false, reason: "unavailable" };
      } catch (cause) {
        return { ok: false, reason: "error", error: toError(cause) };
      } finally {
        setPendingAction(null);
      }
    },
    [worker],
  );

  const pause = useCallback(
    (id: string) => runAction(id, "pause"),
    [runAction],
  );
  const resume = useCallback(
    (id: string) => runAction(id, "resume"),
    [runAction],
  );
  const cancel = useCallback(
    (id: string) => runAction(id, "cancel"),
    [runAction],
  );

  return {
    jobs: streamState?.data ?? [],
    loading: streamState?.loading ?? true,
    error: streamState?.error ?? null,
    pendingAction,
    refresh,
    pause,
    resume,
    cancel,
  };
}
