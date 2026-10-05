// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/telemetry/api.ts", () => ({
  emitLog: vi.fn(),
}));

type Handler = (event: unknown) => void;

/**
 * Two items have a scope of one test.
 * - The rate-limiter counters in errors.ts have module scope. Each test imports
 *   a new module instance. The `resetModules` call runs the mock factory again,
 *   so the test must read `emitLog` after the import.
 * - `captureGlobalErrors` registers listeners on the shared global. The test
 *   intercepts these listeners and calls them directly. The test does not
 *   dispatch the events. Each dispatched event would add one listener per test.
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
  // The mock instance survives `resetModules`. The test must clear its call
  // history for each test. The rate-limiter counters keep their values.
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
  // A failed assertion must not leave the fake clock installed. The fake clock
  // would turn one real failure into many false failures.
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

  it("converts a non-Error rejection reason into a string", async () => {
    await withFreshErrors(({ emitLog, capture, reject }) => {
      capture();
      reject("plain string reason");

      expect(emitLog.mock.calls[0][1]).toBe("plain string reason");
    });
  });

  it("records an uncaught error event", async () => {
    await withFreshErrors(({ emitLog, capture, throwError }) => {
      capture();
      throwError(new Error("sync throw"));

      expect(emitLog.mock.calls[0][1]).toBe("sync throw");
      expect(emitLog.mock.calls[0][2]).toMatchObject({
        "error.source": "uncaught_error",
      });
    });
  });

  it("uses the event message when the event has no error object", async () => {
    await withFreshErrors(({ emitLog, capture, throwError }) => {
      capture();
      throwError(undefined);
      // `error` is undefined, so `describe()` uses `String(...)`.
      expect(errorCalls(emitLog)).toHaveLength(1);
    });
  });

  it("records 10 records per window and suppresses the later records", async () => {
    await withFreshErrors(({ emitLog, capture, reject }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
      capture();

      for (let i = 0; i < 25; i++) reject(new Error(`storm ${i}`));

      expect(errorCalls(emitLog)).toHaveLength(10);
      // The code sends the summary only after the window ends.
      expect(warnCalls(emitLog)).toHaveLength(0);
    });
  });

  it("sends one WARN summary when the window ends", async () => {
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

      // The new window starts with no count. The total is 10 records from the
      // first window plus one record for each window after it. The code never
      // sends the summary twice.
      vi.setSystemTime(new Date("2024-01-01T00:02:01Z"));
      reject(new Error("next window"));
      expect(errorCalls(emitLog)).toHaveLength(12);
      expect(warnCalls(emitLog)).toHaveLength(1);
    });
  });

  it("keeps suppressing records while the same window is active", async () => {
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