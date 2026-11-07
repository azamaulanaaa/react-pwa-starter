/** Defines the environment values for the rust-api adapter. */
export type RustApiEnv = Record<string, string | undefined>;

/** Returns the build-time environment values. */
export function readRustApiEnv(): RustApiEnv {
  return (import.meta as unknown as { env?: RustApiEnv }).env ?? {};
}

/**
 * Reports whether the rust-api adapter is enabled.
 * The switch is off unless `VITE_RUST_API_ENABLED` is one of
 * `1`, `true`, `yes`, or `on`.
 */
export function isRustApiEnabled(env: RustApiEnv = readRustApiEnv()): boolean {
  const value = env.VITE_RUST_API_ENABLED?.trim().toLowerCase();

  return value === "1" || value === "true" || value === "yes" || value === "on";
}
