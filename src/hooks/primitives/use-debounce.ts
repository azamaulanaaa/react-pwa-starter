import { useCallback, useEffect, useRef, useState } from "react";

// deno-lint-ignore no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      cancel();
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        timeoutRef.current = null;
      }, delay);
    },
    [delay, cancel],
  );

  const flush = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        cancel();
        callbackRef.current(...args);
      }
    },
    [cancel],
  );

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
