import { describe, expect, it } from "vitest";

import { backoffDelayMs, DEFAULT_BACKOFF } from "@/worker/outbox/backoff.ts";

describe("outbox backoff", () => {
  it("doubles the delay after each attempt", () => {
    const first = backoffDelayMs(1, () => 1);
    const second = backoffDelayMs(2, () => 1);

    expect(first).toBe(1000);
    expect(second).toBe(2000);
  });

  it("does not pass the five minute cap", () => {
    const delay = backoffDelayMs(20, () => 1);

    expect(delay).toBe(300_000);
    expect(DEFAULT_BACKOFF.maxMs).toBe(300_000);
  });

  it("applies jitter between half and the full delay", () => {
    expect(backoffDelayMs(1, () => 0)).toBe(500);
    expect(backoffDelayMs(1, () => 0.5)).toBe(750);
    expect(backoffDelayMs(1, () => 1)).toBe(1000);
  });
});
