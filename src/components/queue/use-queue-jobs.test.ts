// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useQueueJobs,
  type QueueActionResult,
} from "@/components/queue/use-queue-jobs.ts";
import type { Job } from "@/worker/queue/schema.ts";

const state = vi.hoisted(() => ({
  worker: null as unknown,
}));

vi.mock("@/components/context/worker.tsx", () => ({
  useWorker: () => state.worker,
}));

function makeJob(id: string, jobState: Job["state"]): Job {
  return {
    id,
    kind: "task.run",
    payload: null,
    state: jobState,
    progress: 0,
    attempt: 1,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
    result: null,
    error: null,
  };
}

const JOBS: Job[] = [makeJob("job-1", "queued"), makeJob("job-2", "paused")];

function createJobStream(initial: Job[]) {
  let controller: ReadableStreamDefaultController<Job[]> | null = null;
  const stream = new ReadableStream<Job[]>({
    start(next) {
      controller = next;
      next.enqueue(initial);
    },
  });

  return {
    stream,
    push(value: Job[]) {
      controller?.enqueue(value);
    },
  };
}

function createWorker() {
  const jobs = createJobStream(JOBS);
  const watch = vi.fn(() => jobs.stream);
  const pause = vi.fn(async () => true);
  const resume = vi.fn(async () => true);
  const cancel = vi.fn(async () => true);

  const worker = {
    queue: {
      watch,
      pause,
      resume,
      cancel,
    },
  };

  return { worker, watch, pause, resume, cancel, jobs };
}

describe("useQueueJobs", () => {
  beforeEach(() => {
    state.worker = null;
  });

  it("loads the first jobs snapshot", async () => {
    const fake = createWorker();
    state.worker = fake.worker;

    const { result } = renderHook(() => useQueueJobs());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fake.watch).toHaveBeenCalled();
    expect(result.current.jobs).toEqual(JOBS);
  });

  it("reports a pause result and clears the pending action", async () => {
    const fake = createWorker();
    let resolvePause: (value: boolean) => void = () => {};
    fake.pause.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePause = resolve;
        }),
    );
    state.worker = fake.worker;

    const { result } = renderHook(() => useQueueJobs());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pending: Promise<QueueActionResult> = Promise.resolve({ ok: true });
    act(() => {
      pending = result.current.pause("job-1");
    });

    expect(result.current.pendingAction).toEqual({
      id: "job-1",
      action: "pause",
    });

    await act(async () => {
      resolvePause(true);
      await pending;
    });

    expect(await pending).toEqual({ ok: true });
    expect(result.current.pendingAction).toBeNull();
  });

  it("reports an unavailable resume", async () => {
    const fake = createWorker();
    fake.resume.mockResolvedValue(false);
    state.worker = fake.worker;

    const { result } = renderHook(() => useQueueJobs());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: QueueActionResult = { ok: true };
    await act(async () => {
      outcome = await result.current.resume("job-2");
    });

    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
    expect(result.current.pendingAction).toBeNull();
  });

  it("reports a cancel error", async () => {
    const fake = createWorker();
    fake.cancel.mockRejectedValueOnce(new Error("The worker stopped."));
    state.worker = fake.worker;

    const { result } = renderHook(() => useQueueJobs());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: QueueActionResult = { ok: true };
    await act(async () => {
      outcome = await result.current.cancel("job-1");
    });

    expect(outcome).toEqual({
      ok: false,
      reason: "error",
      error: new Error("The worker stopped."),
    });
    expect(result.current.pendingAction).toBeNull();
  });
});
