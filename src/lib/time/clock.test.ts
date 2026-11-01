import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createServerClock } from "@/lib/time/clock.ts";
import type { ClockStorage } from "@/lib/time/types.ts";

const START_MS = Date.parse("2026-10-30T12:00:00Z");
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Builds a response with the given headers. */
function headerResponse(headers: Record<string, string>): Response {
  return new Response("{}", { status: 200, headers });
}

/** Builds an in-memory storage for one test. */
function createMemoryStorage(): ClockStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("server clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies the server offset to the local clock", () => {
    const clock = createServerClock({ storage: createMemoryStorage() });
    const startedAtMs = Date.now();
    const roundTripMs = 200;
    const serverAheadMs = 2 * ONE_HOUR_MS;

    vi.setSystemTime(startedAtMs + roundTripMs);
    clock.sampleFrom(
      headerResponse({
        "X-Server-Time-Ms": String(startedAtMs + roundTripMs + serverAheadMs),
      }),
      startedAtMs,
    );

    expect(clock.offsetMs()).toBe(serverAheadMs + roundTripMs / 2);
    expect(clock.now()).toBe(
      startedAtMs + roundTripMs + serverAheadMs + roundTripMs / 2,
    );
  });

  it("keeps the offset after a reload", () => {
    const storage = createMemoryStorage();
    const first = createServerClock({ storage });
    const startedAtMs = Date.now();

    first.sampleFrom(
      headerResponse({ "X-Server-Time-Ms": String(START_MS + 5_000) }),
      startedAtMs,
    );

    const second = createServerClock({ storage });

    expect(second.offsetMs()).toBe(5_000);
    expect(second.isStale(startedAtMs + ONE_HOUR_MS - 1)).toBe(false);
  });

  it("marks the offset stale after one hour offline", () => {
    const clock = createServerClock({ storage: createMemoryStorage() });

    clock.sampleFrom(
      headerResponse({ "X-Server-Time-Ms": String(START_MS) }),
      START_MS,
    );

    expect(clock.isStale(START_MS)).toBe(false);
    expect(clock.isStale(START_MS + ONE_HOUR_MS - 1)).toBe(false);
    expect(clock.isStale(START_MS + ONE_HOUR_MS)).toBe(true);
  });

  it("reports a clock with no measurement as stale", () => {
    const clock = createServerClock({ storage: createMemoryStorage() });

    expect(clock.offsetMs()).toBe(0);
    expect(clock.isStale(START_MS)).toBe(true);
  });

  it("falls back to the Date header", () => {
    const clock = createServerClock({ storage: createMemoryStorage() });
    const startedAtMs = START_MS;
    const roundTripMs = 100;
    const serverTimeMs = Date.parse("Fri, 30 Oct 2026 12:00:05 GMT");

    vi.setSystemTime(startedAtMs + roundTripMs);
    clock.sampleFrom(
      headerResponse({ Date: "Fri, 30 Oct 2026 12:00:05 GMT" }),
      startedAtMs,
    );

    expect(clock.offsetMs()).toBe(serverTimeMs - startedAtMs - roundTripMs / 2);
  });

  it("uses the precise header before the Date header", () => {
    const clock = createServerClock({ storage: createMemoryStorage() });
    const startedAtMs = START_MS;

    clock.sampleFrom(
      headerResponse({
        "X-Server-Time-Ms": String(START_MS + 9_000),
        Date: "Fri, 30 Oct 2026 11:00:00 GMT",
      }),
      startedAtMs,
    );

    expect(clock.offsetMs()).toBe(9_000);
  });

  it("keeps the old offset when the header is missing", () => {
    const clock = createServerClock({ storage: createMemoryStorage() });

    clock.sampleFrom(
      headerResponse({ "X-Server-Time-Ms": String(START_MS + 3_000) }),
      START_MS,
    );

    const offsetBefore = clock.offsetMs();
    const laterMs = START_MS + ONE_HOUR_MS + 30_000;

    vi.setSystemTime(laterMs);
    clock.sampleFrom(new Response("{}"), laterMs);

    expect(clock.offsetMs()).toBe(offsetBefore);
    expect(clock.isStale(laterMs)).toBe(true);
  });
});
