import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const PREFIX_NAME = "state-";
const eventTarget = new EventTarget();

export function usePersistState<T extends Record<string, unknown>>(
  name: string,
  defaultValue: T,
  debounceMs: number = 500,
) {
  const finalName = PREFIX_NAME + name;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultValueRef = useRef(defaultValue);
  const computeValue = useCallback(
    (raw: string | null): T => {
      if (raw === null) {
        return defaultValueRef.current;
      }
      try {
        return JSON.parse(raw);
      } catch {
        return defaultValueRef.current;
      }
    },
    [],
  );

  const subscribe = useCallback(
    (callback: () => void) => {
      const handleStorage = (e: StorageEvent) => {
        if (e.key === finalName || e.key === null) {
          callback();
        }
      };

      // deno-lint-ignore no-window no-window-prefix
      window.addEventListener("storage", handleStorage);
      eventTarget.addEventListener(finalName, callback);

      return () => {
        // deno-lint-ignore no-window no-window-prefix
        window.removeEventListener("storage", handleStorage);
        eventTarget.removeEventListener(finalName, callback);
      };
    },
    [finalName],
  );

  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(finalName);
    } catch {
      return null;
    }
  }, [finalName]);

  const getServerSnapshot = useCallback(() => null, []);

  const rawStorageValue = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const [localValue, setLocalValue] = useState<T>(() =>
    computeValue(rawStorageValue)
  );

  const isDebouncingRef = useRef(false);
  const baselineValueRef = useRef<T>(computeValue(rawStorageValue));
  useEffect(() => {
    if (!isDebouncingRef.current) {
      const externalVal = computeValue(rawStorageValue);
      setLocalValue(externalVal);
      baselineValueRef.current = externalVal;
    }
  }, [rawStorageValue, computeValue]);

  const saveToStorage = useCallback(
    (value: T) => {
      try {
        localStorage.setItem(finalName, JSON.stringify(value));
        baselineValueRef.current = value;
        eventTarget.dispatchEvent(new Event(finalName));
      } catch (error) {
        console.error(`Error persisting key "${finalName}":`, error);
      } finally {
        isDebouncingRef.current = false;
      }
    },
    [finalName],
  );

  const setPersistedValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setLocalValue((prev) => {
        const nextValue = typeof newValue === "function"
          ? (newValue as (prev: T) => T)(prev)
          : newValue;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (isEqual(nextValue, baselineValueRef.current)) {
          isDebouncingRef.current = false;
          return nextValue;
        }

        isDebouncingRef.current = true;
        timeoutRef.current = setTimeout(() => {
          saveToStorage(nextValue);
          timeoutRef.current = null;
        }, debounceMs);

        return nextValue;
      });
    },
    [debounceMs, saveToStorage],
  );

  const latestLocalValueRef = useRef(localValue);
  useEffect(() => {
    latestLocalValueRef.current = localValue;
  }, [localValue]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;

        if (!isEqual(latestLocalValueRef.current, baselineValueRef.current)) {
          saveToStorage(latestLocalValueRef.current);
        } else {
          isDebouncingRef.current = false;
        }
      }
    };
  }, [saveToStorage]);

  return [localValue, setPersistedValue] as const;
}

function isEqual<T extends Record<string, unknown>>(
  objA: T,
  objB: T,
): boolean {
  if (Object.is(objA, objB)) return true;

  if (
    typeof objA !== "object" ||
    objA === null ||
    typeof objB !== "object" ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(objB, key) ||
      !Object.is(objA[key], objB[key])
    ) {
      return false;
    }
  }

  return true;
}
