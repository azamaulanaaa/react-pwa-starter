import { useCallback, useEffect, useRef, useState } from "react";

import { useWorker } from "@/components/context/worker.tsx";
import { useReadableStreams } from "@/hooks/primitives/use-readable-stream.ts";
import type {
  OutboxFlushResult,
  OutboxOp,
  OutboxStatus,
} from "@/lib/outbox/types.ts";

const EMPTY_STATUS: OutboxStatus = {
  pending: 0,
  sending: 0,
  failed: 0,
  conflict: 0,
  paused: false,
  signInRequired: false,
};

export interface UseOutboxOpsResult {
  ops: OutboxOp[];
  status: OutboxStatus;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  flushing: boolean;
  resuming: boolean;
  flushResult: OutboxFlushResult | null;
  refresh: () => Promise<void>;
  flush: () => Promise<void>;
  resume: () => Promise<void>;
  dismissFlushResult: () => void;
}

type LoadMode = "initial" | "refresh" | "silent";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Returns the outbox rows and the global actions.
 * The status stream starts a silent list reload after each change.
 * The hook does not poll.
 */
export function useOutboxOps(): UseOutboxOpsResult {
  const worker = useWorker();
  const factory = useRef(() => worker.outbox.watch());
  const params = useRef<null[]>([null]);
  const streams = useReadableStreams(factory.current, params.current);
  const streamState = streams.get(null);
  const statusData = streamState?.data;
  const status = statusData ?? EMPTY_STATUS;

  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [flushResult, setFlushResult] = useState<OutboxFlushResult | null>(
    null,
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: LoadMode): Promise<void> => {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      try {
        const next = await worker.outbox.list();
        if (!mounted.current) return;
        setOps(next);
        setError(null);
      } catch (cause) {
        if (mounted.current) setError(toError(cause));
      } finally {
        if (mounted.current) {
          if (mode === "initial") setLoading(false);
          if (mode === "refresh") setRefreshing(false);
        }
      }
    },
    [worker],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  useEffect(() => {
    if (statusData === undefined) return;
    void load("silent");
  }, [statusData, load]);

  const refresh = useCallback(async (): Promise<void> => {
    setFlushResult(null);
    await load("refresh");
  }, [load]);

  const flush = useCallback(async (): Promise<void> => {
    setFlushing(true);
    setFlushResult(null);
    try {
      const result = await worker.outbox.flush();
      if (!mounted.current) return;
      setFlushResult(result);
      await load("silent");
    } catch (cause) {
      if (mounted.current) setError(toError(cause));
    } finally {
      if (mounted.current) setFlushing(false);
    }
  }, [load, worker]);

  const resume = useCallback(async (): Promise<void> => {
    setResuming(true);
    try {
      await worker.outbox.resume();
      await load("silent");
    } catch (cause) {
      if (mounted.current) setError(toError(cause));
    } finally {
      if (mounted.current) setResuming(false);
    }
  }, [load, worker]);

  const dismissFlushResult = useCallback((): void => {
    setFlushResult(null);
  }, []);

  return {
    ops,
    status,
    loading,
    refreshing,
    error: error ?? streamState?.error ?? null,
    flushing,
    resuming,
    flushResult,
    refresh,
    flush,
    resume,
    dismissFlushResult,
  };
}
