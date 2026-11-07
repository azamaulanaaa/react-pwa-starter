import { describe, expect, it } from "vitest";

import { isRustApiEnabled, readRustApiEnv } from "@/rust-api/shared/config.ts";

describe("rust-api config", () => {
  it("keeps the switch off by default and for a false value", () => {
    expect(isRustApiEnabled({})).toBe(false);
    expect(isRustApiEnabled({ VITE_RUST_API_ENABLED: "false" })).toBe(false);
    expect(isRustApiEnabled({ VITE_RUST_API_ENABLED: "" })).toBe(false);
  });

  it.each(["1", "true", "yes", "on", " TRUE "])(
    "turns the switch on for %s",
    (value) => {
      expect(isRustApiEnabled({ VITE_RUST_API_ENABLED: value })).toBe(true);
    },
  );

  it("reads a defined environment object", () => {
    expect(readRustApiEnv()).toBeTypeOf("object");
  });
});
