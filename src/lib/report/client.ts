import type { FileRecord, FileTransport } from "@/lib/fs/index.ts";

import type { ReportCache } from "@/lib/report/cache.ts";
import { pollReportJob, throwIfAborted } from "@/lib/report/poll.ts";
import type {
  ReportCreateInput,
  ReportJob,
  ReportRequestOptions,
  ReportTransport,
} from "@/lib/report/types.ts";

/** Defines the result of one report call. */
export interface ReportOutcome {
  /** The final job state. */
  job: ReportJob;
  /** The artifact content. The value is null for a failed job. */
  blob: Blob | null;
  /** The artifact file record. The value is null for a failed job. */
  file: FileRecord | null;
  /** The flag is true when the cache supplied the artifact. */
  fromCache: boolean;
}

/** Defines the options for one report call. */
export interface ReportRunOptions {
  /** The signal that stops the poll and the download. */
  signal?: AbortSignal;
  /** Receives each job state after a poll. */
  onJob?: (job: ReportJob) => void;
}

/** Defines the options for the report client. */
export interface ReportClientOptions {
  /** The report transport. */
  transport: ReportTransport;
  /** The file transport. The client calls `download` only. */
  files: Pick<FileTransport, "download">;
  /** The artifact cache. The client skips the download when the cache hits. */
  cache?: ReportCache;
  /** Returns the current time in milliseconds. The default is `Date.now`. */
  now?: () => number;
  /** Waits for one poll delay. A test can replace the default timer. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** The poll deadline in milliseconds. */
  deadlineMs?: number;
  /** The wait times between polls in milliseconds. */
  backoffMs?: readonly number[];
}

/**
 * Defines the report client.
 * The client starts one job, polls it, and downloads the artifact.
 * The client caches the artifact by report id and month.
 */
export interface ReportClient {
  /** Starts one report job and returns its id. */
  create(
    input: ReportCreateInput,
    options?: ReportRequestOptions,
  ): Promise<{ id: string }>;

  /** Returns the state of one report job. */
  get(id: string, options?: ReportRequestOptions): Promise<ReportJob>;

  /**
   * Returns the report artifact for one month.
   * The client uses the cache when the month is present.
   * The client polls the job and downloads the artifact on a miss.
   */
  run(
    input: ReportCreateInput,
    options?: ReportRunOptions,
  ): Promise<ReportOutcome>;
}

/**
 * Creates the report client.
 * The client depends on a report transport and a file transport.
 * The client does not know the backend route.
 */
export function createReportClient(options: ReportClientOptions): ReportClient {
  const { transport, files, cache } = options;
  const now = options.now ?? Date.now;

  return {
    create(input, requestOptions) {
      return transport.create(input, requestOptions);
    },

    get(id, requestOptions) {
      return transport.get(id, requestOptions);
    },

    async run(input, runOptions = {}): Promise<ReportOutcome> {
      const { signal } = runOptions;
      throwIfAborted(signal);

      const month = input.month.trim();
      if (month === "") {
        throw new Error("The report failed. The month is empty.");
      }

      const site = input.site?.trim();
      const request: ReportCreateInput = {
        month,
        site: site === "" ? undefined : site,
      };

      if (cache !== undefined) {
        const cached = await cache.get({ month, site: request.site });

        if (cached !== null) {
          const job: ReportJob = {
            id: cached.reportId,
            state: "succeeded",
            fileId: cached.file.id,
            error: null,
          };
          runOptions.onJob?.(job);

          return {
            job,
            blob: cached.blob,
            file: cached.file,
            fromCache: true,
          };
        }
      }

      throwIfAborted(signal);

      const started = await transport.create(request, { signal });
      throwIfAborted(signal);

      const job = await pollReportJob({
        id: started.id,
        getJob: (id, requestOptions) => transport.get(id, requestOptions),
        signal,
        onJob: runOptions.onJob,
        now,
        sleep: options.sleep,
        deadlineMs: options.deadlineMs,
        backoffMs: options.backoffMs,
      });

      if (job.state === "failed") {
        return { job, blob: null, file: null, fromCache: false };
      }

      if (job.state !== "succeeded") {
        throw new Error("The report failed. The job did not complete.");
      }

      if (job.fileId === null || job.fileId === "") {
        throw new Error("The report failed. The job has no file id.");
      }

      const downloaded = await files.download(job.fileId, { signal });
      throwIfAborted(signal);

      if (cache !== undefined) {
        await cache.set({
          reportId: started.id,
          month,
          site: request.site,
          file: downloaded.file,
          blob: downloaded.blob,
          savedAt: now(),
        });
      }

      return {
        job,
        blob: downloaded.blob,
        file: downloaded.file,
        fromCache: false,
      };
    },
  };
}
