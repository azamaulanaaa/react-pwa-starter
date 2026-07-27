import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

const PREFIX_NAME = "state-";
const eventTarget = new EventTarget();

export type usePersistStateOptions<T> = {
  serializer: (value: T) => string;
  deserializer: (value: string) => T;
};

export function usePersistState<T>(
  name: string,
  defaultValue: T,
  options?: usePersistStateOptions<T>,
) {
  const finalNameRef = useRef(PREFIX_NAME + name);
  const defaultValueRef = useRef(defaultValue);
  const serializerRef = useRef(options?.serializer ?? JSON.stringify);
  const deserializerRef = useRef(options?.deserializer ?? JSON.parse);

  const computeValue = useCallback((raw: string | null): T => {
    if (raw === null) return defaultValueRef.current;
    try {
      return deserializerRef.current(raw);
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
        localStorage.setItem(
          finalNameRef.current,
          serializerRef.current(nextValue),
        );
        eventTarget.dispatchEvent(new Event(finalNameRef.current));
      } catch (error) {
        console.error(`Error persisting key "${finalNameRef.current}":`, error);
      }
    },
    [],
  );

  return [persistedValue, setPersistedValue] as const;
}
