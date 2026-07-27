import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

const PREFIX_NAME = "state-";
const eventTarget = new EventTarget();

export function usePersistState<T extends Record<string, unknown>>(
  name: string,
  defaultValue: T,
) {
  const finalNameRef = useRef(PREFIX_NAME + name);
  const defaultValueRef = useRef(defaultValue);

  const computeValue = useCallback((raw: string | null): T => {
    if (raw === null) return defaultValueRef.current;
    try {
      return JSON.parse(raw);
    } catch {
      return defaultValueRef.current;
    }
  }, []);

  const subscribe = useCallback(
    (callback: () => void) => {
      const handleStorage = (e: StorageEvent) => {
        if (e.key === finalNameRef.current || e.key === null) {
          callback();
        }
      };

      // deno-lint-ignore no-window no-window-prefix
      window.addEventListener("storage", handleStorage);
      eventTarget.addEventListener(finalNameRef.current, callback);

      return () => {
        // deno-lint-ignore no-window no-window-prefix
        window.removeEventListener("storage", handleStorage);
        eventTarget.removeEventListener(finalNameRef.current, callback);
      };
    },
    [],
  );

  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(finalNameRef.current);
    } catch {
      return null;
    }
  }, []);

  const rawStorageValue = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => null,
  );

  const persistedValue = useMemo(
    () => computeValue(rawStorageValue),
    [rawStorageValue, computeValue],
  );

  const latestLocalValueRef = useRef(persistedValue);
  useEffect(() => {
    latestLocalValueRef.current = persistedValue;
  }, [persistedValue]);

  const setPersistedValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const nextValue = typeof newValue === "function"
        ? (newValue as (prev: T) => T)(latestLocalValueRef.current)
        : newValue;

      try {
        localStorage.setItem(finalNameRef.current, JSON.stringify(nextValue));
        eventTarget.dispatchEvent(new Event(finalNameRef.current));
      } catch (error) {
        console.error(`Error persisting key "${finalNameRef.current}":`, error);
      }
    },
    [],
  );

  return [persistedValue, setPersistedValue] as const;
}
