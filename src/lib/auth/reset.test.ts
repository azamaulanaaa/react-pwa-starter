import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_RESET_TABLES,
  resetSession,
  type SessionResetInput,
} from "@/lib/auth/reset.ts";

function createInput(overrides: Partial<SessionResetInput> = {}) {
  const calls: string[] = [];
  const input: SessionResetInput = {
    readOutbox: vi.fn(async () => {
      calls.push("outbox");

      return { pending: 0, sending: 0 };
    }),
    clearTables: vi.fn(async () => {
      calls.push("tables");
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
    logout: vi.fn(async () => {
      calls.push("logout");
    }),
    ...overrides,
  };

  return { input, calls };
}

describe("resetSession", () => {
  it("runs the clear steps in the fixed order", async () => {
    const { input, calls } = createInput();

    const result = await resetSession(input);

    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([
      "outbox",
      "tables",
      "report",
      "runtime",
      "session",
      "logout",
    ]);
  });

  it("uses the system tables when the caller gives no table list", async () => {
    const { input } = createInput();

    await resetSession(input);

    expect(input.clearTables).toHaveBeenCalledWith(DEFAULT_RESET_TABLES);
    expect(DEFAULT_RESET_TABLES).not.toContain("outbox");
  });

  it("checks the outbox before it clears a table", async () => {
    const calls: string[] = [];
    const { input } = createInput({
      readOutbox: vi.fn(async () => {
        calls.push("outbox");

        return { pending: 1, sending: 0 };
      }),
      clearTables: vi.fn(async () => {
        calls.push("tables");
      }),
    });

    const result = await resetSession(input);

    expect(result).toMatchObject({
      ok: false,
      reason: "outbox_pending",
      pending: 1,
      sending: 0,
    });
    expect(calls).toEqual(["outbox"]);
    expect(input.clearTables).not.toHaveBeenCalled();
    expect(input.logout).not.toHaveBeenCalled();
  });

  it("runs every clear step after one step fails", async () => {
    const failure = new Error("The report cache failed.");
    const { input } = createInput({
      clearReportCache: vi.fn(async () => {
        throw failure;
      }),
    });

    const result = await resetSession(input);

    expect(result).toEqual({
      ok: false,
      reason: "reset_failed",
      step: "report",
      error: failure,
    });
    expect(input.clearRuntimeCaches).toHaveBeenCalledOnce();
    expect(input.clearSessionCache).toHaveBeenCalledOnce();
    expect(input.logout).toHaveBeenCalledOnce();
  });

  it("reports the first failed step", async () => {
    const first = new Error("The table clear failed.");
    const second = new Error("The session clear failed.");
    const { input } = createInput({
      clearTables: vi.fn(async () => {
        throw first;
      }),
      clearSessionCache: vi.fn(() => {
        throw second;
      }),
    });

    const result = await resetSession(input);

    expect(result).toEqual({
      ok: false,
      reason: "reset_failed",
      step: "tables",
      error: first,
    });
  });
});
