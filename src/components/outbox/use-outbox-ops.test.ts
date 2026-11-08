// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOutboxOps } from "@/components/outbox/use-outbox-ops.ts";
import type {
  OutboxFlushResult,
  OutboxOp,
  OutboxStatus,
} from "@/lib/outbox/types.ts";

const state = vi.hoisted(() => ({
  worker: null as unknown,
}));

vi.mock("@/components/context/worker.tsx", () => ({
  useWorker: () => state.worker,
}));

const OPS: OutboxOp[] = [
  {
    id: "op-1",
    kind: "note.create",
    method: "POST",
    path: "/api/notes",
    body: { name: "Note" },
    createdAt: 1,
    attempts: 0,
    nextAttemptAt: 1,
    state: "pending",
  },
];

const STATUS: OutboxStatus = {
  pending: 1,
  sending: 0,
  failed: 0,
  conflict: 0,
  paused: false,
  signInRequired: false,
};

const FLUSH_RESULT: OutboxFlushResult = {
  pending: 0,
  sending: 0,
  failed: 0,
  conflict: 0,
  sent: 1,
  paused: false,
  signInRequired: false,
};

function createStatusStream(initial: OutboxStatus) {
  let controller: ReadableStreamDefaultController<OutboxStatus> | null = null;
  const stream = new ReadableStream<OutboxStatus>({
    start(next) {
      controller = next;
      next.enqueue(initial);
    },
  });

  return {
    stream,
    push(value: OutboxStatus) {
      controller?.enqueue(value);
    },
  };
}

function createWorker() {
  const statuses = createStatusStream(STATUS);
  const list = vi.fn(async () => OPS);
  const flush = vi.fn(async () => FLUSH_RESULT);
  const resume = vi.fn(async () => {});

  const worker = {
    outbox: {
      list,
      watch: vi.fn(() => statuses.stream),
      flush,
      resume,
    },
  };

  return {
    worker,
    list,
    flush,
    resume,
    statuses,
  };
}

describe("useOutboxOps", () => {
  beforeEach(() => {
    state.worker = null;
  });

  it("loads the initial list", async () => {
    const fake = createWorker();
    state.worker = fake.worker;

    const { result } = renderHook(() => useOutboxOps());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fake.list).toHaveBeenCalled();
    expect(result.current.ops).toEqual(OPS);
    expect(result.current.status).toEqual(STATUS);
  });

  it("flush calls the worker and reloads the list", async () => {
    const fake = createWorker();
    state.worker = fake.worker;

    const { result } = renderHook(() => useOutboxOps());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = fake.list.mock.calls.length;

    await act(async () => {
      await result.current.flush();
    });

    expect(fake.flush).toHaveBeenCalledOnce();
    expect(result.current.flushResult).toEqual(FLUSH_RESULT);
    expect(fake.list.mock.calls.length).toBeGreaterThan(before);
  });

  it("resume calls the worker and reloads the list", async () => {
    const fake = createWorker();
    state.worker = fake.worker;

    const { result } = renderHook(() => useOutboxOps());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = fake.list.mock.calls.length;

    await act(async () => {
      await result.current.resume();
    });

    expect(fake.resume).toHaveBeenCalledOnce();
    expect(fake.list.mock.calls.length).toBeGreaterThan(before);
  });

  it("clears the flush result on dismiss and on refresh", async () => {
    const fake = createWorker();
    state.worker = fake.worker;

    const { result } = renderHook(() => useOutboxOps());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.flush();
    });
    expect(result.current.flushResult).toEqual(FLUSH_RESULT);

    act(() => {
      result.current.dismissFlushResult();
    });
    expect(result.current.flushResult).toBeNull();

    await act(async () => {
      await result.current.flush();
    });
    expect(result.current.flushResult).toEqual(FLUSH_RESULT);

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.flushResult).toBeNull();
  });

  it("reloads the list after a status change", async () => {
    const fake = createWorker();
    state.worker = fake.worker;

    const { result } = renderHook(() => useOutboxOps());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = fake.list.mock.calls.length;

    act(() => {
      fake.statuses.push({ ...STATUS, pending: 0, failed: 1 });
    });

    await waitFor(() => {
      expect(result.current.status.failed).toBe(1);
      expect(fake.list.mock.calls.length).toBeGreaterThan(before);
    });
  });
});
