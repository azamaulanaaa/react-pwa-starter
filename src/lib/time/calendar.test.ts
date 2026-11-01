import { afterEach, describe, expect, it, vi } from "vitest";

import { organizationDay, shiftWindow } from "@/lib/time/calendar.ts";

const ONE_HOUR_MS = 60 * 60 * 1000;

describe("organization day", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("puts a 23:30 event in the local day, not the UTC day", () => {
    const eventMs = Date.parse("2026-10-31T03:30:00Z");

    expect(organizationDay(eventMs, "America/New_York")).toBe("2026-10-30");
    expect(organizationDay(eventMs, "UTC")).toBe("2026-10-31");
  });

  it("puts a 23:30 Jakarta event in the Jakarta day", () => {
    const eventMs = Date.parse("2026-10-30T16:30:00Z");

    expect(organizationDay(eventMs, "Asia/Jakarta")).toBe("2026-10-30");
  });

  it("does not use the device timezone for the day boundary", () => {
    vi.stubEnv("TZ", "America/Los_Angeles");
    const instantMs = Date.parse("2026-10-30T23:30:00Z");

    expect(organizationDay(instantMs, "Asia/Jakarta")).toBe("2026-10-31");
    expect(organizationDay(instantMs, "UTC")).toBe("2026-10-30");
  });
});

describe("shift window", () => {
  it("keeps an overnight shift on its start date", () => {
    const window = shiftWindow(
      "2026-10-30",
      { start: "22:00", end: "06:00" },
      "Asia/Jakarta",
    );

    expect(window.day).toBe("2026-10-30");
    expect(window.startMs).toBe(Date.parse("2026-10-30T15:00:00Z"));
    expect(window.endMs).toBe(Date.parse("2026-10-30T23:00:00Z"));
    expect(window.endMs - window.startMs).toBe(8 * ONE_HOUR_MS);
    expect(organizationDay(window.startMs, "Asia/Jakarta")).toBe("2026-10-30");
    expect(organizationDay(window.endMs - 1, "Asia/Jakarta")).toBe(
      "2026-10-31",
    );
  });

  it("keeps a day shift on its start date", () => {
    const window = shiftWindow(
      "2026-10-30",
      { start: "09:00", end: "17:00" },
      "Asia/Jakarta",
    );

    expect(window.startMs).toBe(Date.parse("2026-10-30T02:00:00Z"));
    expect(window.endMs).toBe(Date.parse("2026-10-30T10:00:00Z"));
  });

  it("uses the explicit overnight flag when the times are equal", () => {
    const window = shiftWindow(
      "2026-10-30",
      { start: "08:00", end: "08:00", overnight: true },
      "UTC",
    );

    expect(window.endMs - window.startMs).toBe(24 * ONE_HOUR_MS);
  });
});
