/**
 * OpenTelemetry configuration. The values come from Vite environment variables.
 *
 * All variables are optional. The code provides default values.
 * To point the app at a local collector, set this variable:
 *
 *   VITE_OTEL_ENDPOINT=http://localhost:4318
 */

// SAFETY: vite/client types are not visible to every language server in this
// repo. At build time, Vite always provides `import.meta.env` as a string map.
const ENV =
  (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env ??
    {};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return !["false", "0", "off", "no"].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Standard OTLP HTTP collector port. A local Grafana Alloy or a local Jaeger
 * uses this port.
 */
const DEFAULT_OTLP_ENDPOINT = "http://localhost:4318";

export interface TelemetryConfig {
  /** Master switch for all telemetry collection and export. */
  enabled: boolean;
  /** OTLP HTTP base URL. The code appends the traces, metrics, and logs paths. */
  endpoint: string;
  /** The `service.name` attribute that the app reports to the backend. */
  serviceName: string;
  /** Build environment name, such as `"development"` or `"production"`. */
  environment: string;
  /** Root span sampling ratio in [0, 1]. */
  sampleRatio: number;
  /** The interval at which the metric reader exports data, in milliseconds. */
  metricExportIntervalMs: number;
  /**
   * If true, `setupTelemetry()` refuses to start until the user grants consent.
   */
  requireConsent: boolean;
}

/**
 * Build-time gate. If it is false, `main.tsx` skips the dynamic import.
 * The code never fetches the OTel chunk.
 * This function must stay SDK-free. `main.tsx` imports it statically.
 */
export function isEnabledAtBuildTime(): boolean {
  return ENV.MODE !== "test" && parseBool(ENV.VITE_OTEL_ENABLED, true);
}

export function resolveTelemetryConfig(): TelemetryConfig {
  const enabled = isEnabledAtBuildTime();

  const endpoint = (ENV.VITE_OTEL_ENDPOINT ?? DEFAULT_OTLP_ENDPOINT).replace(
    /\/+$/,
    "",
  );

  return {
    enabled,
    endpoint,
    serviceName: ENV.VITE_OTEL_SERVICE_NAME ?? __APP_NAME__,
    environment: ENV.MODE ?? "production",
    sampleRatio: Math.min(
      1,
      Math.max(0, parseNumber(ENV.VITE_OTEL_SAMPLE_RATIO, 1)),
    ),
    metricExportIntervalMs: parseNumber(
      ENV.VITE_OTEL_METRIC_EXPORT_INTERVAL_MS,
      30_000,
    ),
    requireConsent: parseBool(ENV.VITE_OTEL_REQUIRE_CONSENT, false),
  };
}
