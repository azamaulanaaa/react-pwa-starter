import type {
  ClockSample,
  ClockStorage,
  ServerClock,
  ServerClockOptions,
  StoredClockOffset,
} from "@/lib/time/types.ts";

/** Defines the default storage key for the clock offset. */
export const CLOCK_STORAGE_KEY = "app.server-clock.v1";

/** Defines the age that makes the offset stale. The value is one hour. */
export const CLOCK_STALE_AFTER_MS = 60 * 60 * 1000;

const memoryValues = new Map<string, string>();

const memoryStorage: ClockStorage = {
  getItem(key) {
    return memoryValues.get(key) ?? null;
  },
  setItem(key, value) {
    memoryValues.set(key, value);
  },
};

/**
 * Returns the storage for the clock offset.
 * The function uses `localStorage` when the caller gives no storage.
 * The function uses memory when `localStorage` is absent or blocked.
 */
function resolveStorage(
  storage: ClockStorage | null | undefined,
): ClockStorage | null {
  if (storage === null) return null;
  if (storage !== undefined) return storage;

  try {
    const candidate = (globalThis as { localStorage?: ClockStorage })
      .localStorage;
    return candidate ?? memoryStorage;
  } catch {
    return memoryStorage;
  }
}

/**
 * Reads the last offset from the storage.
 * The function returns null for a missing or invalid value.
 */
function readStoredOffset(
  storage: ClockStorage,
  key: string,
): StoredClockOffset | null {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;

    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== "object") return null;

    const { offsetMs, measuredAtMs } = value as Partial<StoredClockOffset>;
    if (!Number.isFinite(offsetMs) || !Number.isFinite(measuredAtMs)) {
      return null;
    }

    return {
      offsetMs: offsetMs as number,
      measuredAtMs: measuredAtMs as number,
    };
  } catch {
    return null;
  }
}

/**
 * Reads the server time from a response.
 * The `X-Server-Time-Ms` header wins.
 * The `Date` header is the fallback. The `Date` header has one-second resolution.
 * The function returns null when both headers are absent or invalid.
 */
export function serverTimeFromResponse(response: Response): number | null {
  const precise = response.headers.get("X-Server-Time-Ms");
  if (precise !== null && precise.trim() !== "") {
    const value = Number(precise.trim());
    if (Number.isFinite(value)) return value;
  }

  const date = response.headers.get("Date");
  if (date !== null) {
    const value = Date.parse(date);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

/**
 * Computes the offset from one sample.
 * The function removes one half of the round trip from the client time.
 */
export function offsetFromSample(sample: ClockSample): number {
  return sample.serverTimeMs - sample.clientTimeMs - sample.roundTripMs / 2;
}

/**
 * Creates a server clock.
 * The clock loads the last offset from the storage at start.
 * The clock saves each new offset with its measurement time.
 */
export function createServerClock(
  options: ServerClockOptions = {},
): ServerClock {
  const storage = resolveStorage(options.storage);
  const storageKey = options.storageKey ?? CLOCK_STORAGE_KEY;
  const staleAfterMs = options.staleAfterMs ?? CLOCK_STALE_AFTER_MS;
  const stored =
    storage === null ? null : readStoredOffset(storage, storageKey);

  let offset = stored?.offsetMs ?? 0;
  let measuredAtMs = stored?.measuredAtMs ?? null;

  function save(nextOffsetMs: number, receivedAtMs: number): void {
    offset = nextOffsetMs;
    measuredAtMs = receivedAtMs;

    if (storage === null) return;

    try {
      const value: StoredClockOffset = {
        offsetMs: nextOffsetMs,
        measuredAtMs: receivedAtMs,
      };
      storage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // The offset stays in memory when the storage rejects the write.
    }
  }

  return {
    now() {
      return Date.now() + offset;
    },
    offsetMs() {
      return offset;
    },
    sampleFrom(response, startedAtMs) {
      const serverTimeMs = serverTimeFromResponse(response);
      if (serverTimeMs === null) return;

      const receivedAtMs = Date.now();
      const sample: ClockSample = {
        serverTimeMs,
        clientTimeMs: startedAtMs,
        receivedAtMs,
        roundTripMs: Math.max(0, receivedAtMs - startedAtMs),
      };

      save(offsetFromSample(sample), receivedAtMs);
    },
    isStale(nowMs) {
      if (measuredAtMs === null) return true;
      return nowMs - measuredAtMs >= staleAfterMs;
    },
  };
}
