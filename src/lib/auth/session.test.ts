import { describe, expect, it } from "vitest";

import { REFRESH_LEAD_MS, refreshDelayMs } from "@/lib/auth/session.ts";

describe("refreshDelayMs", () => {
  it("schedules the refresh 60 seconds before expiry", () => {
    const delay = refreshDelayMs({ user: { id: "u1" }, expiresAt: 100_000 }, 0);

    expect(delay).toBe(100_000 - REFRESH_LEAD_MS);
  });

  it("returns zero when the refresh time has passed", () => {
    const delay = refreshDelayMs(
      { user: { id: "u1" }, expiresAt: 100_000 },
      100_000,
    );

    expect(delay).toBe(0);
  });
});
