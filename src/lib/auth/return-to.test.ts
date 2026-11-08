import { describe, expect, it } from "vitest";

import { createMemorySessionStorage } from "@/lib/auth/cache.ts";
import {
  clearReturnTo,
  consumeReturnTo,
  rememberReturnTo,
  RETURN_TO_KEY,
  safeReturnTo,
} from "@/lib/auth/return-to.ts";

describe("return path guard", () => {
  it("returns a safe relative path unchanged", () => {
    expect(safeReturnTo("/settings?tab=profile#top")).toBe(
      "/settings?tab=profile#top",
    );
  });

  it("returns null for a missing value or a blank value", () => {
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo("")).toBeNull();
    expect(safeReturnTo("   ")).toBeNull();
  });

  it("returns null for a path that does not start with a slash", () => {
    expect(safeReturnTo("settings")).toBeNull();
  });

  it("returns null for an absolute URL and a protocol-relative path", () => {
    expect(safeReturnTo("https://example.com/settings")).toBeNull();
    expect(safeReturnTo("//example.com/settings")).toBeNull();
  });

  it("returns null for a backslash and an encoded backslash", () => {
    expect(safeReturnTo("/settings\\profile")).toBeNull();
    expect(safeReturnTo("/settings%5cprofile")).toBeNull();
    expect(safeReturnTo("/settings%5Cprofile")).toBeNull();
  });

  it("returns null for a C0 control character and DELETE", () => {
    expect(safeReturnTo("/settings\u0000profile")).toBeNull();
    expect(safeReturnTo("/settings\u001fprofile")).toBeNull();
    expect(safeReturnTo("/settings\u007fprofile")).toBeNull();
  });

  it("accepts a C1 control character", () => {
    expect(safeReturnTo("/settings\u0085profile")).toBe(
      "/settings\u0085profile",
    );
  });
});

describe("return path storage", () => {
  it("stores a safe path", () => {
    const storage = createMemorySessionStorage();

    expect(rememberReturnTo("/settings", storage)).toBe("/settings");
    expect(storage.getItem(RETURN_TO_KEY)).toBe("/settings");
  });

  it("ignores an unsafe path and a missing storage", () => {
    const storage = createMemorySessionStorage();

    expect(rememberReturnTo("/settings\nprofile", storage)).toBeNull();
    expect(storage.getItem(RETURN_TO_KEY)).toBeNull();
    expect(rememberReturnTo("/settings", null)).toBeNull();
  });

  it("returns and removes a safe path", () => {
    const storage = createMemorySessionStorage();
    storage.setItem(RETURN_TO_KEY, "/settings");

    expect(consumeReturnTo(storage)).toBe("/settings");
    expect(storage.getItem(RETURN_TO_KEY)).toBeNull();
  });

  it("returns null for an unsafe stored path and removes it", () => {
    const storage = createMemorySessionStorage();
    storage.setItem(RETURN_TO_KEY, "https://example.com/settings");

    expect(consumeReturnTo(storage)).toBeNull();
    expect(storage.getItem(RETURN_TO_KEY)).toBeNull();
  });

  it("removes the stored value", () => {
    const storage = createMemorySessionStorage();
    storage.setItem(RETURN_TO_KEY, "/settings");

    clearReturnTo(storage);

    expect(storage.getItem(RETURN_TO_KEY)).toBeNull();
  });
});
