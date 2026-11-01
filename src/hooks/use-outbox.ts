import { useRef } from "react";

import { useWorker } from "@/components/context/worker.tsx";
import { useReadableStreams } from "@/hooks/primitives/use-readable-stream.ts";
import type { OutboxStatus } from "@/lib/outbox/types.ts";

const EMPTY_STATUS: OutboxStatus = {
  pending: 0,
  sending: 0,
  failed: 0,
  conflict: 0,
  paused: false,
  signInRequired: false,
};

export type UseOutboxResult = OutboxStatus & {
  /** The flag is true while the first status arrives. */
  loading: boolean;
  /** The last stream error. The value is null when no error exists. */
  error: Error | null;
};

/**
 * Returns the outbox counts for the UI.
 * The hook reads the worker stream over the existing Comlink context.
 * The hook does not start a second worker.
 */
export function useOutbox(): UseOutboxResult {
  const worker = useWorker();
  const factory = useRef(() => worker.outbox.watch());
  const params = useRef([null]);
  const streams = useReadableStreams(factory.current, params.current);
  const state = streams.get(null);
  const status = state?.data ?? EMPTY_STATUS;

  return {
    pending: status.pending,
    sending: status.sending,
    failed: status.failed,
    conflict: status.conflict,
    paused: status.paused,
    signInRequired: status.signInRequired,
    loading: state?.loading ?? true,
    error: state?.error ?? null,
  };
}
