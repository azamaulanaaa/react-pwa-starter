// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useDebounce,
  useDebouncedCallback,
} from "@/hooks/primitives/use-debounce.ts";

describe("useDebouncedCallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not invoke the callback before the delay elapses", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => result.current("a"));
    vi.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(callback).toHaveBeenCalledExactlyOnceWith("a");
  });

  it("collapses rapid calls and keeps only the latest arguments", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => {
      result.current("first");
      result.current("second");
      result.current("third");
    });
    act(() => vi.advanceTimersByTime(100));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("third");
  });

  it("cancel() prevents a pending invocation", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => result.current("a"));
    act(() => result.current.cancel());
    act(() => vi.advanceTimersByTime(500));

    expect(callback).not.toHaveBeenCalled();
  });

  it("flush() invokes a pending call immediately", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => result.current("pending"));
    act(() => result.current.flush());
    expect(callback).toHaveBeenCalledExactlyOnceWith("pending");

    // The flushed timer must not fire a second time afterwards.
    act(() => vi.advanceTimersByTime(500));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("flush() is a no-op when nothing is pending", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => result.current.flush());
    expect(callback).not.toHaveBeenCalled();
  });

  it("uses the latest callback without restarting the timer", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ callback }) => useDebouncedCallback(callback, 100),
      { initialProps: { callback: first } },
    );

    act(() => result.current("a"));
    rerender({ callback: second });
    act(() => vi.advanceTimersByTime(100));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith("a");
  });

  it("cancels a pending timer on unmount", () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDebouncedCallback(callback, 100)
    );

    act(() => result.current("a"));
    unmount();
    act(() => vi.advanceTimersByTime(500));

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the initial value immediately, then lags behind", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: "a" } },
    );

    expect(result.current).toBe("a");

    rerender({ value: "b" });
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("b");
  });

  it("settles on the last value across a burst of updates", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: "a" } },
    );

    act(() => {
      rerender({ value: "b" });
      rerender({ value: "c" });
      rerender({ value: "d" });
    });
    act(() => vi.advanceTimersByTime(100));

    expect(result.current).toBe("d");
  });
});