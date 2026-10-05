// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePersistState } from "@/hooks/primitives/use-persist-state.ts";

const KEY = "state-test_persist";

describe("usePersistState", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns the default value when nothing is stored", () => {
    const { result } = renderHook(() => usePersistState("test_persist", 1));

    expect(result.current[0]).toBe(1);
  });

  it("persists a written value and reads it back", () => {
    const { result } = renderHook(() => usePersistState("test_persist", 1));

    act(() => result.current[1](2));

    expect(localStorage.getItem(KEY)).toBe("2");
    expect(result.current[0]).toBe(2);
  });

  it("resolves a functional update with the latest value", () => {
    const { result } = renderHook(() => usePersistState("test_persist", 1));

    act(() => result.current[1]((prev) => prev + 5));
    act(() => result.current[1]((prev) => prev + 5));

    expect(result.current[0]).toBe(11);
  });

  it("returns the default value when the stored JSON is invalid", () => {
    localStorage.setItem(KEY, "{not valid json");

    const { result } = renderHook(() =>
      usePersistState("test_persist", "fallback")
    );

    expect(result.current[0]).toBe("fallback");
  });

  it("deserializes stored values with a custom deserializer", () => {
    localStorage.setItem(KEY, "42");

    const { result } = renderHook(() =>
      usePersistState("test_persist", 0, {
        serializer: (value: number) => `#${value}`,
        deserializer: (raw: string) => Number(raw.replace("#", "")),
      })
    );

    expect(result.current[0]).toBe(42);
  });

  it("keeps the previous value and logs an error when persistence throws", () => {
    const error = new Error("quota exceeded");
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(
      () => {
        throw error;
      },
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => usePersistState("test_persist", 1));
    act(() => result.current[1](2));

    expect(consoleError).toHaveBeenCalled();
    expect(result.current[0]).toBe(1);
    expect(setItem).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});