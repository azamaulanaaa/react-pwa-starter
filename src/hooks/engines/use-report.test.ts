// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FileTransport } from "@/lib/fs/index.ts";
import { useReport } from "@/hooks/engines/use-report.ts";
import { createReportClient } from "@/lib/report/client.ts";
import type {
  ReportClient,
  ReportJob,
  ReportOutcome,
  ReportTransport,
} from "@/lib/report/index.ts";

const FILE = {
  id: "file-1",
  size: 4,
  metadata: { name: "recap.csv", mimetype: "text/csv" },
};

/** Builds one report job with the default values. */
function reportJob(overrides: Partial<ReportJob> = {}): ReportJob {
  return {
    id: "job-1",
    state: "queued",
    fileId: null,
    error: null,
    ...overrides,
  };
}

describe("useReport", () => {
  it("does not poll after the screen closes", async () => {
    let notifySleep: (() => void) | null = null;
    const sleepStarted = new Promise<void>((resolve) => {
      notifySleep = resolve;
    });
    const sleep = (_ms: number, signal?: AbortSignal): Promise<void> => {
      return new Promise<void>((_resolve, reject) => {
        notifySleep?.();

        const onAbort = () => {
          reject(new DOMException("The report was aborted.", "AbortError"));
        };

        if (signal?.aborted) {
          onAbort();
          return;
        }

        signal?.addEventListener("abort", onAbort, { once: true });
      });
    };
    const get = vi.fn(async () => reportJob({ state: "running" }));
    const transport: ReportTransport = {
      create: vi.fn(async () => ({ id: "job-1" })),
      get,
    };
    const download = vi.fn(async (_id: string): Promise<never> => {
      throw new Error("The test must not download.");
    });
    const files: Pick<FileTransport, "download"> = { download };
    const client = createReportClient({ transport, files, sleep });
    const { result, unmount } = renderHook(() => useReport(client));

    let start: Promise<void> = Promise.resolve();
    act(() => {
      start = result.current.start({ month: "2026-10" });
    });
    await sleepStarted;

    expect(get).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await start;
    });

    expect(get).toHaveBeenCalledTimes(1);
    expect(download).not.toHaveBeenCalled();
  });

  it("shows the failure reason", async () => {
    const job = reportJob({
      state: "failed",
      error: {
        code: "internal",
        message: "The report failed. The archive is not available.",
      },
    });
    const outcome: ReportOutcome = {
      job,
      blob: null,
      file: null,
      fromCache: false,
    };
    const client: ReportClient = {
      create: vi.fn(async () => ({ id: "job-1" })),
      get: vi.fn(async () => job),
      run: vi.fn(async (_input, options) => {
        options?.onJob?.(job);

        return outcome;
      }),
    };
    const { result } = renderHook(() => useReport(client));

    await act(async () => {
      await result.current.start({ month: "2026-10" });
    });

    expect(result.current.state).toBe("failed");
    expect(result.current.job?.error?.message).toBe(
      "The report failed. The archive is not available.",
    );
    expect(result.current.blob).toBeNull();
  });

  it("returns the artifact blob on success", async () => {
    const blob = new Blob(["data"], { type: "text/csv" });
    const job = reportJob({ state: "succeeded", fileId: FILE.id });
    const outcome: ReportOutcome = {
      job,
      blob,
      file: FILE,
      fromCache: false,
    };
    const client: ReportClient = {
      create: vi.fn(async () => ({ id: "job-1" })),
      get: vi.fn(async () => job),
      run: vi.fn(async (_input, options) => {
        options?.onJob?.(job);

        return outcome;
      }),
    };
    const { result } = renderHook(() => useReport(client));

    await act(async () => {
      await result.current.start({ month: "2026-10" });
    });

    expect(result.current.state).toBe("succeeded");
    expect(result.current.job).toBe(job);
    expect(result.current.blob).toBe(blob);
  });
});
