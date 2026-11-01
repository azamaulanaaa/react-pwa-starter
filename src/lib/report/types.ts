import type { FileId } from "@/lib/fs/index.ts";

/** Defines the state of one report job. */
export type ReportState = "queued" | "running" | "succeeded" | "failed";

/** Defines the failure reason of one report job. */
export interface ReportError {
  /** The stable error code. */
  code: string;
  /** The message for the caller. */
  message: string;
}

/** Describes one report job. */
export interface ReportJob {
  /** The job identifier. */
  id: string;
  /** The current job state. */
  state: ReportState;
  /** The artifact file id. The value is null until the job succeeds. */
  fileId: FileId | null;
  /** The failure reason. The value is null when the job has no error. */
  error: ReportError | null;
}

/** Defines the input for one report job. */
export interface ReportCreateInput {
  /** The month in `YYYY-MM` form. */
  month: string;
  /** The site id. The server uses the caller site when the value is absent. */
  site?: string;
}

/** Defines the options for one report request. */
export interface ReportRequestOptions {
  /** The signal that cancels the request. */
  signal?: AbortSignal;
}

/**
 * Defines a backend-neutral report transport.
 * The transport starts one job and returns the job state.
 * The transport does not poll and does not download the artifact.
 */
export interface ReportTransport {
  /** Starts one report job. */
  create(
    input: ReportCreateInput,
    options?: ReportRequestOptions,
  ): Promise<{ id: string }>;

  /** Returns the state of one report job. */
  get(id: string, options?: ReportRequestOptions): Promise<ReportJob>;
}
