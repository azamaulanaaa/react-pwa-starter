import { useCallback, useEffect, useRef, useState } from "react";

// deno-lint-ignore no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Arguments of the currently pending call, so flush() can replay them
  // instead of invoking the callback with undefined.
  const pendingArgsRef = useRef<unknown[] | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingArgsRef.current = null;
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      cancel();
      pendingArgsRef.current = args;
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        timeoutRef.current = null;
        pendingArgsRef.current = null;
      }, delay);
    },
    [delay, cancel],
  );

  // Runs any pending call immediately, replaying the arguments it was called
  // with. Takes no arguments of its own so the replayed call is never
  // accidentally invoked with undefined.
  const flush = useCallback((): void => {
    if (!timeoutRef.current) return;
    // Capture before cancel() clears the pending slot.
    const pending = pendingArgsRef.current ?? [];
    cancel();
    callbackRef.current(...pending);
  }, [cancel]);

  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return Object.assign(debouncedCallback, { cancel, flush });
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  const update = useDebouncedCallback((val: T) => {
    setDebouncedValue(val);
  }, delay);

  useEffect(() => {
    update(value);
  }, [value, update]);

  return debouncedValue;
}
