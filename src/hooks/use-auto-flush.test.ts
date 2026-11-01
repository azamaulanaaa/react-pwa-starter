// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutoFlush } from "@/hooks/use-auto-flush.ts";
import type { OutboxStatus } from "@/lib/outbox/types.ts";

const state = vi.hoisted(() => ({
  online: false,
  visible: false,
  session: null as unknown,
  worker: null as unknown,
}));

vi.mock("@/components/context/worker.tsx", () => ({
  useWorker: () => state.worker,
}));

vi.mock("@/components/context/session.tsx", () => ({
  useSession: () => state.session,
}));

const SESSION = {
  user: { id: "u1", name: "Alice" },
  expiresAt: 4_102_444_800_000,
};

const EMPTY: OutboxStatus = {
  pending: 0,
  sending: 0,
  failed: 0,
  conflict: 0,
  paused: false,
  signInRequired: false,
};

function sessionValue(status: "authenticated" | "loading" | "unauthenticated") {
  return {
    session: status === "authenticated" ? SESSION : null,
    status,
    error: null,
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    refresh: vi.fn(async () => SESSION),
  };
}

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
    push(status: OutboxStatus) {
      controller?.enqueue(status);
    },
  };
}

function createWorker(initial: OutboxStatus) {
  const calls: string[] = [];
  const statuses = createStatusStream(initial);
  const worker = {
    outbox: {
      resume: vi.fn(async () => {
        calls.push("resume");
      }),
      flush: vi.fn(async () => {
        calls.push("flush");

        return { ...initial, sent: 0 };
      }),
      watch: vi.fn(() => statuses.stream),
      status: vi.fn(async () => initial),
    },
    db: { clearTables: vi.fn(async () => ({ tables: [], removed: 0 })) },
  };

  return { worker, calls, statuses };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useAutoFlush", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.online = false;
    state.visible = false;
    state.session = sessionValue("authenticated");
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => state.online,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (state.visible ? "visible" : "hidden"),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window.navigator, "onLine");
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("flushes when the network returns", async () => {
    const fake = createWorker({ ...EMPTY, pending: 1 });
    state.worker = fake.worker;
    state.visible = true;

    renderHook(() => useAutoFlush());
    await settle();
    expect(fake.calls).toEqual(["resume"]);

    state.online = true;
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await settle();

    expect(fake.calls).toEqual(["resume", "flush"]);
  });

  it("flushes when the tab becomes visible", async () => {
    const fake = createWorker({ ...EMPTY, pending: 1 });
    state.worker = fake.worker;
    state.online = true;

    renderHook(() => useAutoFlush());
    await settle();
    expect(fake.calls).toEqual(["resume", "flush"]);
    fake.calls.length = 0;

    state.visible = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await settle();

    expect(fake.calls).toEqual(["flush"]);
  });

  it("does not flush while the tab is hidden and the network is down", async () => {
    const fake = createWorker({ ...EMPTY, pending: 1 });
    state.worker = fake.worker;

    renderHook(() => useAutoFlush());
    await settle();

    act(() => {
      vi.advanceTimersByTime(180_000);
    });
    await settle();

    expect(fake.calls).toEqual(["resume"]);
  });

  it("flushes every 60 seconds while a write waits", async () => {
    const fake = createWorker({ ...EMPTY, pending: 1 });
    state.worker = fake.worker;
    state.online = true;
    state.visible = true;

    renderHook(() => useAutoFlush());
    await settle();
    fake.calls.length = 0;

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    await settle();
    expect(fake.calls).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    await settle();
    expect(fake.calls).toEqual(["flush"]);
  });

  it("keeps the sign-in pause on a timer flush", async () => {
    const fake = createWorker({ ...EMPTY, pending: 1 });
    fake.worker.outbox.flush.mockImplementation(async () => {
      fake.calls.push("flush");

      return {
        ...EMPTY,
        pending: 1,
        paused: true,
        signInRequired: true,
        sent: 0,
      };
    });
    state.worker = fake.worker;
    state.online = true;
    state.visible = true;

    renderHook(() => useAutoFlush());
    await settle();
    expect(fake.calls).toEqual(["resume", "flush"]);

    fake.calls.length = 0;
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    await settle();

    expect(fake.calls).toEqual(["flush"]);
    expect(fake.worker.outbox.resume).toHaveBeenCalledOnce();
  });

  it("flushes after a successful login", async () => {
    const fake = createWorker(EMPTY);
    state.worker = fake.worker;
    state.online = true;
    state.session = sessionValue("loading");

    const { rerender } = renderHook(() => useAutoFlush());
    await settle();
    expect(fake.calls).toEqual([]);

    state.session = sessionValue("authenticated");
    rerender();
    await settle();

    expect(fake.calls).toEqual(["resume", "flush"]);
  });
});
