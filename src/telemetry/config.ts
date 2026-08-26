/**
 * OpenTelemetry configuration resolved from Vite environment variables.
 *
 * All variables are optional; sensible defaults are provided so that pointing
 * the app at a local collector is just:
 *
 *   VITE_OTEL_ENDPOINT=http://localhost:4318
 */

// SAFETY: vite/client types are not visible to every language server in this
// repo; at build time Vite always provides `import.meta.env` as a string map.
const ENV =
	(import.meta as unknown as { env?: Record<string, string | undefined> }).env ??
	{};

function parseBool(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined || value === "") return fallback;
	return !["false", "0", "off", "no"].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
	const parsed = Number.parseFloat(value ?? "");
	return Number.isFinite(parsed) ? parsed : fallback;
}

/** Standard OTLP HTTP collector port (e.g. a local Grafana Alloy/Jaeger). */
const DEFAULT_OTLP_ENDPOINT = "http://localhost:4318";

export interface TelemetryConfig {
	/** Master kill-switch for all telemetry collection & export. */
	enabled: boolean;
	/** OTLP HTTP base URL (traces/metrics/logs paths are appended). */
	endpoint: string;
	/** service.name resource attribute reported to the backend. */
	serviceName: string;
	/** Build environment name, e.g. "development" | "production". */
	environment: string;
	/** Root span sampling ratio in [0, 1]. */
	sampleRatio: number;
	/** Metric reader export interval. */
	metricExportIntervalMs: number;
	/** When true, setupTelemetry() refuses to start until consent is granted. */
	requireConsent: boolean;
}

/**
 * Build-time gate — when false, main.tsx skips the dynamic import entirely so
 * the OTel chunk is never even fetched. Must stay SDK-free (statically
 * imported from main.tsx).
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
