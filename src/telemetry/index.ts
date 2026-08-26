/**
 * OpenTelemetry bootstrap for the browser.
 *
 * This module is intentionally heavy (SDK + exporters) and is reached only
 * through a dynamic `import()` from main.tsx so the OTel SDK lives in its own
 * lazy chunk and never blocks first paint. See src/telemetry/api.ts for the
 * statically-importable helper surface.
 */
import { trace, metrics } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import {
	ParentBasedSampler,
	TraceIdRatioBasedSampler,
	BatchSpanProcessor,
	WebTracerProvider,
} from "@opentelemetry/sdk-trace-web";
import {
	MeterProvider,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
	LoggerProvider,
	BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import {
	resourceFromAttributes,
	defaultResource,
} from "@opentelemetry/resources";

import { sessionId } from "@/telemetry/api.ts";
import { resolveTelemetryConfig } from "@/telemetry/config.ts";

/**
 * Initialize trace/metric/log providers with OTLP HTTP exporters.
 * Telemetry failures must never break the app, so callers are expected to
 * swallow errors.
 */
export function setupTelemetry(): void {
	const config = resolveTelemetryConfig();
	if (!config.enabled) return;

	const resource = defaultResource().merge(
		resourceFromAttributes({
			"service.name": config.serviceName,
			"deployment.environment.name": String(config.environment),
			"session.id": sessionId(),
		}),
	);

	// --- Traces ---
	const tracerProvider = new WebTracerProvider({
		resource,
		sampler: new ParentBasedSampler({
			root: new TraceIdRatioBasedSampler(config.sampleRatio),
		}),
		spanProcessors: [
			new BatchSpanProcessor(
				new OTLPTraceExporter({ url: `${config.endpoint}/v1/traces` }),
			),
		],
	});
	tracerProvider.register();

	// --- Metrics ---
	const meterProvider = new MeterProvider({
		resource,
		readers: [
			new PeriodicExportingMetricReader({
				exporter: new OTLPMetricExporter({
					url: `${config.endpoint}/v1/metrics`,
				}),
				exportIntervalMillis: config.metricExportIntervalMs,
			}),
		],
	});

	// --- Logs ---
	const loggerProvider = new LoggerProvider({
		resource,
		processors: [
			new BatchLogRecordProcessor({
				exporter: new OTLPLogExporter({
					url: `${config.endpoint}/v1/logs`,
				}),
			}),
		],
	});

	trace.setGlobalTracerProvider(tracerProvider);
	metrics.setGlobalMeterProvider(meterProvider);
	logs.setGlobalLoggerProvider(loggerProvider);
}
