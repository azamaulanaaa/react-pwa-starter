import type { ReportJob, ReportRequestOptions } from "@/lib/report/types.ts";

/** Defines the wait times between the report polls in milliseconds. */
export const REPORT_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000] as const;

/** Defines the report poll deadline in milliseconds. */
export const REPORT_DEADLINE_MS = 10 * 60 * 1000;

/** Defines the error code for a report job that misses the deadline. */
export const REPORT_TIMEOUT_CODE = "timeout";

/** Builds the error that an aborted report call returns. */
function abortError(signal?: AbortSignal): Error {
  const reason = signal?.reason;

  if (reason instanceof Error) return reason;

  return new DOMException("The report was aborted.", "AbortError");
}

/** Stops the caller when the signal is aborted. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal);
}

/** Waits for one delay and stops when the signal aborts. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError(signal));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Builds a failed job for a poll that misses the deadline. */
function timeoutJob(id: string): ReportJob {
  return {
    id,
    state: "failed",
    fileId: null,
    error: {
      code: REPORT_TIMEOUT_CODE,
      message: "The report failed. The job did not finish before the deadline.",
    },
  };
}

/** Defines the options for one report poll. */
export interface PollReportOptions {
  /** The job identifier. */
  id: string;
  /** Returns the current job state. */
  getJob(id: string, options?: ReportRequestOptions): Promise<ReportJob>;
  /** The signal that stops the poll. */
  signal?: AbortSignal;
  /** Returns the current time in milliseconds. The default is `Date.now`. */
  now?: () => number;
  /** Waits for one delay. A test can replace the default timer. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** The poll deadline in milliseconds. */
  deadlineMs?: number;
  /** The wait times between polls in milliseconds. */
  backoffMs?: readonly number[];
  /** Receives each job state after a poll. */
  onJob?: (job: ReportJob) => void;
}

/**
 * Polls one report job until it finishes.
 * The poll uses the backoff list and stops at the deadline.
 * The poll returns a failed job when the deadline passes.
 */
export async function pollReportJob(
  options: PollReportOptions,
): Promise<ReportJob> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? wait;
  const deadlineMs = options.deadlineMs ?? REPORT_DEADLINE_MS;
  const backoff = options.backoffMs ?? REPORT_BACKOFF_MS;
  const deadline = now() + deadlineMs;
  let attempt = 0;

  for (;;) {
    throwIfAborted(options.signal);

    const job = await options.getJob(options.id, {
      signal: options.signal,
    });
    options.onJob?.(job);
    throwIfAborted(options.signal);

    if (job.state === "succeeded" || job.state === "failed") return job;

    if (now() >= deadline) return timeoutJob(options.id);

    const index = Math.min(attempt, backoff.length - 1);
    const delay = backoff.length === 0 ? deadlineMs : (backoff[index] ?? 15000);
    attempt += 1;

    const remaining = deadline - now();
    if (remaining <= delay) {
      await sleep(remaining, options.signal);
      throwIfAborted(options.signal);
      return timeoutJob(options.id);
    }

    await sleep(delay, options.signal);
  }
}
