import { useCallback, useEffect, useRef, useState } from "react";

import { useSession } from "@/components/context/session.tsx";
import { useWorker } from "@/components/context/worker.tsx";
import { useConnectivity } from "@/hooks/use-connectivity.ts";
import { useOutbox } from "@/hooks/use-outbox.ts";
import type { OutboxFlushResult } from "@/lib/outbox/types.ts";

/** The default flush interval. The value is 60 seconds. */
export const AUTO_FLUSH_INTERVAL_MS = 60_000;

/** Defines the result of the auto-flush hook. */
export interface UseAutoFlushResult {
  /** The current network state. */
  online: boolean;
  /** The current tab visibility. */
  visible: boolean;
  /** The time of the last successful flush. */
  lastSyncAt: number | null;
  /** The last flush error. The value is null when no error exists. */
  error: Error | null;
  /** Runs one flush now. */
  flushNow: () => Promise<OutboxFlushResult | null>;
}

/** Defines the options for the auto-flush hook. */
export interface UseAutoFlushOptions {
  /** The flush interval in milliseconds. The default is 60 seconds. */
  intervalMs?: number;
}

/**
 * Flushes the outbox at the times that the browser can observe.
 * The hook flushes on the online event, on a visible tab, and after a login.
 * The hook flushes every 60 seconds while a write waits and the tab is visible.
 * The hook resumes the outbox one time for each authenticated user.
 * The hook does not use the Background Sync API.
 */
export function useAutoFlush(
  options: UseAutoFlushOptions = {},
): UseAutoFlushResult {
  const intervalMs = options.intervalMs ?? AUTO_FLUSH_INTERVAL_MS;
  const worker = useWorker();
  const { session, status } = useSession();
  const outbox = useOutbox();
  const connectivity = useConnectivity();
  const { online, visible, lastSyncAt, markSynced } = connectivity;
  const [error, setError] = useState<Error | null>(null);

  const statusRef = useRef(status);
  const onlineRef = useRef(online);
  const mounted = useRef(true);
  statusRef.current = status;
  onlineRef.current = online;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const recordError = useCallback((cause: unknown) => {
    if (mounted.current) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }, []);

  const flushNow = useCallback(async (): Promise<OutboxFlushResult | null> => {
    if (statusRef.current !== "authenticated" || !onlineRef.current) {
      return null;
    }

    try {
      const result = await worker.outbox.flush();

      if (mounted.current) {
        markSynced();
        setError(null);
      }

      return result;
    } catch (cause) {
      recordError(cause);

      return null;
    }
  }, [markSynced, recordError, worker]);

  const lastUser = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user.id ?? null;

    if (status !== "authenticated" || userId === null) {
      if (status === "unauthenticated") lastUser.current = null;

      return;
    }

    if (lastUser.current === userId) return;

    lastUser.current = userId;

    void (async () => {
      try {
        await worker.outbox.resume();
      } catch (cause) {
        recordError(cause);

        return;
      }

      if (onlineRef.current) await flushNow();
    })();
  }, [flushNow, recordError, session, status, worker]);

  const wasOnline = useRef(online);

  useEffect(() => {
    if (online && !wasOnline.current) void flushNow();

    wasOnline.current = online;
  }, [flushNow, online]);

  const wasVisible = useRef(visible);

  useEffect(() => {
    if (visible && !wasVisible.current && online) void flushNow();

    wasVisible.current = visible;
  }, [flushNow, online, visible]);

  const hasPending = outbox.pending > 0;

  useEffect(() => {
    if (status !== "authenticated" || !online || !visible || !hasPending) {
      return;
    }

    const timer = setInterval(() => {
      void flushNow();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [flushNow, hasPending, intervalMs, online, status, visible]);

  return {
    online,
    visible,
    lastSyncAt,
    error,
    flushNow,
  };
}
