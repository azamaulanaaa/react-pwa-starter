// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/telemetry/api.ts", () => ({
  emitLog: vi.fn(),
}));

type Handler = (event: unknown) => void;

/**
 * Two things are per-test scoped:
 *  - the rate-limiter counters in errors.ts are module-level, so each test
 *    imports a fresh module instance (resetModules re-runs the mock factory,
 *    so emitLog must be read after the import);
 *  - captureGlobalErrors registers listeners on the shared global, so they are
 *    intercepted and invoked directly instead of dispatched, which would
 *    otherwise accumulate one listener per test.
 */
const withFreshErrors = async (
  run: (ctx: {
    emitLog: Mock;
    capture: () => void;
    reject: (reason: unknown) => void;
    throwError: (error: unknown) => void;
  }) => void,
): Promise<void> => {
  vi.resetModules();
  const api = await import("@/telemetry/api.ts");
  const { captureGlobalErrors } = await import("@/telemetry/errors.ts");

  const emitLogMock = api.emitLog as Mock;
  // The mock instance survives resetModules, so its call history must be
  // cleared per test even though the rate-limiter counters do not.
  emitLogMock.mockClear();
  const handlers: Record<string, Handler[]> = {
    error: [],
    unhandledrejection: [],
  };
  const addSpy = vi.spyOn(globalThis, "addEventListener").mockImplementation(
    // deno-lint-ignore no-explicit-any
    ((type: string, handler: any) => {
      if (handlers[type]) handlers[type].push(handler);
      // deno-lint-ignore no-explicit-any
    }) as any,
  );

  try {
    run({
      emitLog: emitLogMock,
      capture: captureGlobalErrors,
      reject: (reason) =>
        handlers.unhandledrejection.forEach((h) => h({ reason })),
      throwError: (error) =>
        handlers.error.forEach((h) => h({ error })),
    });
  } finally {
    addSpy.mockRestore();
  }
};

const errorCalls = (emitLog: Mock) =>
  emitLog.mock.calls.filter((call) => call[0] === "ERROR");

const warnCalls = (emitLog: Mock) =>
  emitLog.mock.calls.filter((call) => call[0] === "WARN");

describe("captureGlobalErrors", () => {
  // A failed assertion must not leave the fake clock installed, which would
  // turn one real failure into cascading false negatives.
  afterEach(() => {
    vi.useRealTimers();
  });
  it("emits an ERROR record for an unhandled rejection", async () => {
    await withFreshErrors(({ emitLog, capture, reject }) => {
      capture();
      reject(new Error("boom"));

      expect(errorCalls(emitLog)).toHaveLength(1);
      expect(emitLog.mock.calls[0][1]).toBe("boom");
      expect(emitLog.mock.calls[0][2]).toMatchObject({
        "error.source": "unhandled_rejection",
      });
    });
  });

  it("unwraps a nested rejection reason", async () => {
    await withFreshErrors(({ emitLog, capture, reject }) => {
      capture();
      reject({ reason: { reason: new Error("deeply nested") } });

      expect(emitLog.mock.calls[0][1]).toBe("deeply nested");
    });
  });

  it("stringifies a non-Error rejection reason", async () => {
    await withFreshErrors(({ emitLog, capture, reject }) => {
      capture();
      reject("plain string reason");

      expect(emitLog.mock.calls[0][1]).toBe("plain string reason");
    });
  });

  it("captures an uncaught error event", async () => {
    await withFreshErrors(({ emitLog, capture, throwError }) => {
      capture();
      throwError(new Error("sync throw"));

      expect(emitLog.mock.calls[0][1]).toBe("sync throw");
      expect(emitLog.mock.calls[0][2]).toMatchObject({
        "error.source": "uncaught_error",
      });
    });
  });

  it("falls back to the event message when no error object is present", async () => {
    await withFreshErrors(({ emitLog, capture, throwError }) => {
      capture();
      throwError(undefined);
      // `error` is undefined, so describe() falls back to String(...).
      expect(errorCalls(emitLog)).toHaveLength(1);
    });
  });

  it("caps a storm at 10 records per window and suppresses the rest", async () => {
    await withFreshErrors(({ emitLog, capture, reject }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
      capture();

      for (let i = 0; i < 25; i++) reject(new Error(`storm ${i}`));

      expect(errorCalls(emitLog)).toHaveLength(10);
      // The summary is only emitted once the window rolls over.
      expect(warnCalls(emitLog)).toHaveLength(0);
    });
  });

  it("emits a single WARN summary when the window rolls over", async () => {
    await withFreshErrors(({ emitLog, capture, reject }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
      capture();

      for (let i = 0; i < 15; i++) reject(new Error(`storm ${i}`));
      expect(errorCalls(emitLog)).toHaveLength(10);

      vi.setSystemTime(new Date("2024-01-01T00:01:01Z"));
      reject(new Error("after the window"));

      const warns = warnCalls(emitLog);
      expect(warns).toHaveLength(1);
      expect(warns[0][1]).toContain("5 error records suppressed");
      expect(warns[0][2]).toMatchObject({ "error.suppressed": 5 });

      // The new window starts clean: 10 from the first window, plus one
      // accepted record per rollover, and the summary is never repeated.
      vi.setSystemTime(new Date("2024-01-01T00:02:01Z"));
      reject(new Error("next window"));
      expect(errorCalls(emitLog)).toHaveLength(12);
      expect(warnCalls(emitLog)).toHaveLength(1);
    });
  });

  it("keeps suppressing while the same window is still active", async () => {
    await withFreshErrors(({ emitLog, capture, reject }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
      capture();

      for (let i = 0; i < 12; i++) reject(new Error(`a ${i}`));
      expect(errorCalls(emitLog)).toHaveLength(10);

      vi.setSystemTime(new Date("2024-01-01T00:00:30Z"));
      for (let i = 0; i < 3; i++) reject(new Error(`b ${i}`));

      expect(errorCalls(emitLog)).toHaveLength(10);
      expect(warnCalls(emitLog)).toHaveLength(0);
    });
  });
});