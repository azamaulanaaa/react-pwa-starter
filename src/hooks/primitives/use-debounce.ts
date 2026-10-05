import { useCallback, useEffect, useRef, useState } from "react";

// deno-lint-ignore no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Arguments of the pending call.
  // flush() replays them instead of calling the callback with undefined.
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

  // Runs the pending call immediately and replays its arguments.
  // flush() takes no arguments, so it never calls the callback with undefined.
  const flush = useCallback((): void => {
    if (!timeoutRef.current) return;
    // The code reads the arguments before cancel() clears the pending slot.
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
