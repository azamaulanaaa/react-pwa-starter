import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ReportClient,
  ReportCreateInput,
  ReportJob,
  ReportState,
} from "@/lib/report/index.ts";

/** Defines the report state that the hook shows. */
export type UseReportState = ReportState | "idle";

/** Defines the value that the report hook returns. */
export interface UseReportResult {
  /** The current job state. */
  state: UseReportState;
  /** The current job. The value is null before the first start. */
  job: ReportJob | null;
  /** The artifact content. The value is null before the download. */
  blob: Blob | null;
  /** Starts one report call and replaces the previous call. */
  start(input: ReportCreateInput): Promise<void>;
  /** Stops the poll and the download. */
  abort(): void;
}

/**
 * Runs one report job and exposes its state.
 * The hook stops the call when the screen closes.
 * The hook does not render a screen.
 */
export function useReport(client: ReportClient): UseReportResult {
  const clientRef = useRef(client);
  clientRef.current = client;

  const [state, setState] = useState<UseReportState>("idle");
  const [job, setJob] = useState<ReportJob | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const jobRef = useRef<ReportJob | null>(null);
  const runRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const start = useCallback(async (input: ReportCreateInput): Promise<void> => {
    runRef.current += 1;
    const runId = runRef.current;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    jobRef.current = null;
    setState("queued");
    setJob(null);
    setBlob(null);

    const isCurrent = () => mountedRef.current && runRef.current === runId;

    try {
      const outcome = await clientRef.current.run(input, {
        signal: controller.signal,
        onJob: (next) => {
          if (!isCurrent()) return;

          jobRef.current = next;
          setJob(next);
          setState(next.state);
        },
      });

      if (!isCurrent()) return;

      jobRef.current = outcome.job;
      setJob(outcome.job);
      setState(outcome.job.state);
      setBlob(outcome.blob);
    } catch (error) {
      if (!isCurrent()) return;

      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "The report failed. The request did not complete.";
      const failedJob: ReportJob = {
        id: jobRef.current?.id ?? "",
        state: "failed",
        fileId: null,
        error: { code: "request_failed", message },
      };

      jobRef.current = failedJob;
      setJob(failedJob);
      setState("failed");
      setBlob(null);
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, []);

  return { state, job, blob, start, abort };
}
