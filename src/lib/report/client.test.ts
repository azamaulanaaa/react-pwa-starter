import { describe, expect, it, vi } from "vitest";

import type { FileTransport } from "@/lib/fs/index.ts";
import { createReportCache } from "@/lib/report/cache.ts";
import { createReportClient } from "@/lib/report/client.ts";
import { REPORT_TIMEOUT_CODE } from "@/lib/report/poll.ts";
import type {
  ReportCacheStore,
  ReportJob,
  ReportTransport,
} from "@/lib/report/index.ts";

const FILE = {
  id: "file-1",
  size: 4,
  metadata: { name: "recap.csv", mimetype: "text/csv" },
};
const BLOB = new Blob(["data"], { type: "text/csv" });

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

/** Builds a fake report transport that returns the jobs in order. */
function createTransport(jobs: ReportJob[]): {
  transport: ReportTransport;
  create: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
} {
  let index = 0;
  const create = vi.fn(async () => ({ id: "job-1" }));
  const get = vi.fn(async () => {
    const job = jobs[Math.min(index, jobs.length - 1)];
    index += 1;

    return job ?? reportJob();
  });

  return { transport: { create, get }, create, get };
}

/** Builds a fake file transport. */
function createFiles(): {
  files: Pick<FileTransport, "download">;
  download: ReturnType<typeof vi.fn>;
} {
  const download = vi.fn(async () => ({ file: FILE, blob: BLOB }));

  return { files: { download }, download };
}

/** Builds a clock with a manual time value. */
function createClock(): {
  now: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
} {
  let time = 0;

  return {
    now: () => time,
    sleep: async (ms, signal) => {
      if (signal?.aborted) {
        throw new DOMException("The report was aborted.", "AbortError");
      }

      time += ms;
    },
  };
}

/** Builds an in-memory cache store. */
function createMemoryStore(): ReportCacheStore {
  const values = new Map<string, unknown>();

  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value);
    },
    clear: async () => {
      values.clear();
    },
  };
}

describe("report client", () => {
  it("polls until the report is ready", async () => {
    const clock = createClock();
    const { transport, get } = createTransport([
      reportJob({ state: "queued" }),
      reportJob({ state: "running" }),
      reportJob({ state: "succeeded", fileId: FILE.id }),
    ]);
    const { files, download } = createFiles();
    const client = createReportClient({
      transport,
      files,
      now: clock.now,
      sleep: clock.sleep,
    });
    const states: string[] = [];

    const outcome = await client.run(
      { month: "2026-10" },
      {
        onJob: (job) => {
          states.push(job.state);
        },
      },
    );

    expect(get).toHaveBeenCalledTimes(3);
    expect(states).toEqual(["queued", "running", "succeeded"]);
    expect(outcome.job.state).toBe("succeeded");
    expect(outcome.fromCache).toBe(false);
    expect(download).toHaveBeenCalledWith(FILE.id, expect.anything());
  });

  it("downloads the artifact once", async () => {
    const clock = createClock();
    const { transport, create } = createTransport([
      reportJob({ state: "succeeded", fileId: FILE.id }),
    ]);
    const { files, download } = createFiles();
    const cache = createReportCache({
      store: createMemoryStore(),
      now: clock.now,
    });
    const client = createReportClient({
      transport,
      files,
      cache,
      now: clock.now,
      sleep: clock.sleep,
    });

    await client.run({ month: "2026-10" });
    const second = await client.run({ month: "2026-10" });

    expect(create).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
    expect(second.fromCache).toBe(true);
  });

  it("shows the failure reason", async () => {
    const clock = createClock();
    const failure = {
      code: "internal",
      message: "The report failed. The archive is not available.",
    };
    const { transport } = createTransport([
      reportJob({ state: "failed", error: failure }),
    ]);
    const { files, download } = createFiles();
    const client = createReportClient({
      transport,
      files,
      now: clock.now,
      sleep: clock.sleep,
    });

    const outcome = await client.run({ month: "2026-10" });

    expect(outcome.job.state).toBe("failed");
    expect(outcome.job.error).toEqual(failure);
    expect(outcome.blob).toBeNull();
    expect(download).not.toHaveBeenCalled();
  });

  it("uses the cached artifact for the same month", async () => {
    const clock = createClock();
    const { transport, create } = createTransport([
      reportJob({ state: "succeeded", fileId: FILE.id }),
    ]);
    const { files, download } = createFiles();
    const cache = createReportCache({
      store: createMemoryStore(),
      now: clock.now,
    });
    const client = createReportClient({
      transport,
      files,
      cache,
      now: clock.now,
      sleep: clock.sleep,
    });

    const first = await client.run({ month: "2026-10" });
    const second = await client.run({ month: "2026-10" });

    expect(create).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
    expect(second.job.id).toBe(first.job.id);
    expect(second.file).toEqual(FILE);
    await expect(second.blob?.text()).resolves.toBe("data");
  });

  it("stops after the deadline", async () => {
    const clock = createClock();
    const { transport, get } = createTransport([
      reportJob({ state: "running" }),
    ]);
    const { files, download } = createFiles();
    const client = createReportClient({
      transport,
      files,
      now: clock.now,
      sleep: clock.sleep,
      deadlineMs: 5000,
      backoffMs: [1000],
    });

    const outcome = await client.run({ month: "2026-10" });

    expect(get).toHaveBeenCalledTimes(5);
    expect(outcome.job.state).toBe("failed");
    expect(outcome.job.error?.code).toBe(REPORT_TIMEOUT_CODE);
    expect(outcome.blob).toBeNull();
    expect(download).not.toHaveBeenCalled();
  });

  it("stops the poll when the caller aborts", async () => {
    const clock = createClock();
    const controller = new AbortController();
    const get = vi.fn(async () => {
      controller.abort();

      return reportJob({ state: "running" });
    });
    const transport: ReportTransport = {
      create: vi.fn(async () => ({ id: "job-1" })),
      get,
    };
    const { files, download } = createFiles();
    const client = createReportClient({
      transport,
      files,
      now: clock.now,
      sleep: clock.sleep,
    });

    const run = client.run({ month: "2026-10" }, { signal: controller.signal });

    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(get).toHaveBeenCalledTimes(1);
    expect(download).not.toHaveBeenCalled();
  });
});
