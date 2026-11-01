// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionReset } from "@/hooks/use-session-reset.ts";
import { DEFAULT_RESET_TABLES } from "@/lib/auth/reset.ts";

const state = vi.hoisted(() => ({
  session: null as unknown,
  worker: null as unknown,
}));

vi.mock("@/components/context/worker.tsx", () => ({
  useWorker: () => state.worker,
}));

vi.mock("@/components/context/session.tsx", () => ({
  useSession: () => state.session,
}));

function sessionValue(userId: string) {
  return {
    session: { user: { id: userId }, expiresAt: 4_102_444_800_000 },
    status: "authenticated",
    error: null,
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    refresh: vi.fn(async () => null),
  };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useSessionReset", () => {
  beforeEach(() => {
    state.worker = {
      outbox: { status: vi.fn(async () => ({ pending: 0, sending: 0 })) },
      db: { clearTables: vi.fn(async () => ({ tables: [], removed: 0 })) },
    };
  });

  it("drops the cache on a user change", async () => {
    const cleared: string[][] = [];
    const clearTables = vi.fn(async (names) => {
      cleared.push([...names]);
    });
    const clearReportCache = vi.fn(async () => {});
    const clearRuntimeCaches = vi.fn(async () => {});
    const clearSessionCache = vi.fn();
    state.session = sessionValue("u1");

    const { rerender } = renderHook(() =>
      useSessionReset({
        readOutbox: vi.fn(async () => ({ pending: 0, sending: 0 })),
        clearTables,
        clearReportCache,
        clearRuntimeCaches,
        clearSessionCache,
      }),
    );
    await settle();

    expect(clearTables).not.toHaveBeenCalled();

    state.session = sessionValue("u2");
    rerender();
    await settle();

    expect(cleared).toEqual([[...DEFAULT_RESET_TABLES]]);
    expect(clearReportCache).toHaveBeenCalledOnce();
    expect(clearRuntimeCaches).toHaveBeenCalledOnce();
    expect(clearSessionCache).not.toHaveBeenCalled();
  });

  it("keeps the data when the same user refreshes the session", async () => {
    const clearTables = vi.fn(async () => {});
    state.session = sessionValue("u1");

    const { rerender } = renderHook(() =>
      useSessionReset({
        readOutbox: vi.fn(async () => ({ pending: 0, sending: 0 })),
        clearTables,
        clearReportCache: vi.fn(async () => {}),
        clearRuntimeCaches: vi.fn(async () => {}),
        clearSessionCache: vi.fn(),
      }),
    );
    await settle();

    state.session = sessionValue("u1");
    rerender();
    await settle();

    expect(clearTables).not.toHaveBeenCalled();
  });
});
