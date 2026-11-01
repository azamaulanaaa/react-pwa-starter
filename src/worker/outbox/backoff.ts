/** Defines the limits of the retry delay. */
export type BackoffOptions = {
  /** The delay of the first retry in milliseconds. */
  baseMs: number;
  /** The largest delay in milliseconds. */
  maxMs: number;
};

/** Defines the default retry delay. The cap is five minutes. */
export const DEFAULT_BACKOFF: BackoffOptions = {
  baseMs: 1000,
  maxMs: 300_000,
};

/**
 * Returns the delay before the next attempt.
 * The function doubles the delay after each attempt.
 * The function applies jitter in the range 50 to 100 percent.
 * The function never returns a value above the cap.
 */
export function backoffDelayMs(
  attempts: number,
  random: () => number,
  options: BackoffOptions = DEFAULT_BACKOFF,
): number {
  const exponent = Math.max(0, attempts - 1);
  const ceiling = Math.min(options.maxMs, options.baseMs * 2 ** exponent);
  const sample = Math.min(Math.max(random(), 0), 1);
  const jitter = 0.5 + sample * 0.5;

  return Math.min(options.maxMs, Math.floor(ceiling * jitter));
}
