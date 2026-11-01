// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSafeLogout } from "@/hooks/use-safe-logout.ts";
import { DEFAULT_RESET_TABLES } from "@/lib/auth/reset.ts";
import type { SessionResetResult } from "@/lib/auth/reset.ts";

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

function createSession(logout: () => Promise<void>) {
  return {
    session: { user: { id: "u1" }, expiresAt: 4_102_444_800_000 },
    status: "authenticated",
    error: null,
    login: vi.fn(async () => {}),
    logout,
    refresh: vi.fn(async () => null),
  };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useSafeLogout", () => {
  beforeEach(() => {
    state.worker = {
      outbox: { status: vi.fn(async () => ({ pending: 0, sending: 0 })) },
      db: { clearTables: vi.fn(async () => ({ tables: [], removed: 0 })) },
    };
  });

  it("clears the user tables on logout", async () => {
    const calls: string[] = [];
    const cleared: string[][] = [];
    const logout = vi.fn(async () => {
      calls.push("logout");
    });
    state.session = createSession(logout);

    const { result } = renderHook(() =>
      useSafeLogout({
        readOutbox: vi.fn(async () => {
          calls.push("outbox");

          return { pending: 0, sending: 0 };
        }),
        clearTables: vi.fn(async (names) => {
          calls.push("tables");
          cleared.push([...names]);
        }),
        clearReportCache: vi.fn(async () => {
          calls.push("report");
        }),
        clearRuntimeCaches: vi.fn(async () => {
          calls.push("runtime");
        }),
        clearSessionCache: vi.fn(() => {
          calls.push("session");
        }),
      }),
    );

    let reset: SessionResetResult | undefined;
    await act(async () => {
      reset = await result.current.logout();
    });

    expect(reset).toEqual({ ok: true });
    expect(cleared).toEqual([[...DEFAULT_RESET_TABLES]]);
    expect(calls).toEqual([
      "outbox",
      "tables",
      "report",
      "runtime",
      "session",
      "logout",
    ]);
    expect(logout).toHaveBeenCalledOnce();
    expect(result.current.running).toBe(false);
  });

  it("clears the cache before the next user signs in", async () => {
    const logout = vi.fn(async () => {});
    state.session = createSession(logout);
    let resolveClear: () => void = () => {};
    const cleared = new Promise<void>((resolve) => {
      resolveClear = resolve;
    });
    const clearTables = vi.fn(() => cleared);

    const { result } = renderHook(() =>
      useSafeLogout({
        readOutbox: vi.fn(async () => ({ pending: 0, sending: 0 })),
        clearTables,
        clearReportCache: vi.fn(async () => {}),
        clearRuntimeCaches: vi.fn(async () => {}),
        clearSessionCache: vi.fn(),
      }),
    );

    let running: Promise<SessionResetResult> = Promise.resolve({ ok: true });
    act(() => {
      running = result.current.logout();
    });
    await settle();

    expect(clearTables).toHaveBeenCalledOnce();
    expect(logout).not.toHaveBeenCalled();

    await act(async () => {
      resolveClear();
      await running;
    });

    expect(logout).toHaveBeenCalledOnce();
  });

  it("blocks logout while the outbox has pending writes", async () => {
    const logout = vi.fn(async () => {});
    const clearTables = vi.fn(async () => {});
    state.session = createSession(logout);

    const { result } = renderHook(() =>
      useSafeLogout({
        readOutbox: vi.fn(async () => ({ pending: 2, sending: 1 })),
        clearTables,
        clearReportCache: vi.fn(async () => {}),
        clearRuntimeCaches: vi.fn(async () => {}),
        clearSessionCache: vi.fn(),
      }),
    );

    let reset: SessionResetResult | undefined;
    await act(async () => {
      reset = await result.current.logout();
    });

    expect(reset).toMatchObject({
      ok: false,
      reason: "outbox_pending",
      pending: 2,
      sending: 1,
    });
    expect(clearTables).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it("keeps the outbox when the network is down", async () => {
    const logout = vi.fn(async () => {});
    state.session = createSession(logout);
    const cleared: string[][] = [];

    const { result } = renderHook(() =>
      useSafeLogout({
        readOutbox: vi.fn(async () => ({ pending: 0, sending: 0 })),
        clearTables: vi.fn(async (names) => {
          cleared.push([...names]);
        }),
        clearReportCache: vi.fn(async () => {}),
        clearRuntimeCaches: vi.fn(async () => {}),
        clearSessionCache: vi.fn(),
      }),
    );

    let reset: SessionResetResult | undefined;
    await act(async () => {
      reset = await result.current.logout();
    });

    expect(reset).toEqual({ ok: true });
    expect(cleared.flat()).not.toContain("outbox");
    expect(logout).toHaveBeenCalledOnce();
  });
});
