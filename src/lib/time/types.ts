/**
 * Holds one measurement of the server clock.
 * The times are UTC milliseconds.
 */
export type ClockSample = {
  /** The server time from the response header, in UTC milliseconds. */
  serverTimeMs: number;
  /** The client time at the request start, in UTC milliseconds. */
  clientTimeMs: number;
  /** The client time when the response arrived, in UTC milliseconds. */
  receivedAtMs: number;
  /** The time from the request start to the response, in milliseconds. */
  roundTripMs: number;
};

/**
 * Reads the server time from one response.
 * The API client calls this interface for every response.
 */
export type ClockSampler = {
  /**
   * Samples the server time from a response.
   * The call keeps the old offset when the response has no time header.
   */
  sampleFrom: (response: Response, startedAtMs: number) => void;
};

/**
 * Holds the last offset that the storage keeps.
 * The measurement time makes the offset stale after a period offline.
 */
export type StoredClockOffset = {
  /** The value to add to the client time, in milliseconds. */
  offsetMs: number;
  /** The client time of the last measurement, in UTC milliseconds. */
  measuredAtMs: number;
};

/**
 * Defines the server clock.
 * The clock adds the server offset to the local time.
 */
export type ServerClock = ClockSampler & {
  /** Returns the server time in UTC milliseconds. */
  now: () => number;
  /** Returns the current offset in milliseconds. */
  offsetMs: () => number;
  /** Reports whether the last measurement is older than the stale limit. */
  isStale: (nowMs: number) => boolean;
};

/**
 * Defines the minimal storage that keeps the clock offset.
 * A browser `Storage` object implements this shape.
 */
export type ClockStorage = {
  /** Returns the stored text for the key, or null. */
  getItem: (key: string) => string | null;
  /** Stores the text for the key. */
  setItem: (key: string, value: string) => void;
};

/** Defines the options for the server clock. */
export type ServerClockOptions = {
  /**
   * The storage for the offset.
   * The clock uses `localStorage` when this is absent.
   * The clock keeps the offset in memory when this is null.
   */
  storage?: ClockStorage | null;
  /** The storage key. The default is `app.server-clock.v1`. */
  storageKey?: string;
  /** The age that makes the offset stale. The default is one hour. */
  staleAfterMs?: number;
};
