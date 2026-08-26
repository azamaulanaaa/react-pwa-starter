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
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";

import { sessionId } from "@/telemetry/api.ts";
import { resolveTelemetryConfig } from "@/telemetry/config.ts";
import { instrumentRouter } from "@/telemetry/router.ts";
import {
	observeWebVitals,
	observePageLifecycle,
} from "@/telemetry/web-vitals.ts";
import { captureGlobalErrors } from "@/telemetry/errors.ts";

export interface TelemetryOptions {
	/** The app router instance — used to emit navigation spans/metrics. */
	router: RouterLike;
}

/** Minimal structural type of the TanStack Router surface we need. */
interface RouterLike {
	subscribe: (
		eventType: "onBeforeLoad" | "onResolved",
		fn: (event: {
			toLocation: { pathname: string };
			pathChanged: boolean;
		}) => void,
	) => () => void;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Initialize providers, exporters and instrumentations.
 * Resolves once everything is registered; telemetry failures must never break
 * the app, so callers are expected to swallow errors.
 */
export function setupTelemetry({ router }: TelemetryOptions): void {
	const config = resolveTelemetryConfig();
	if (!config.enabled) return;

	const resource = defaultResource().merge(
		resourceFromAttributes({
			"service.name": config.serviceName,
			"deployment.environment.name": String(config.environment),
			"session.id": sessionId(),
		}),
	);

	const endpointRegex = new RegExp(`^${escapeRegExp(config.endpoint)}`);

	// --- Traces ---
	const traceExporter = new OTLPTraceExporter({
		url: `${config.endpoint}/v1/traces`,
	});
	const tracerProvider = new WebTracerProvider({
		resource,
		sampler: new ParentBasedSampler({
			root: new TraceIdRatioBasedSampler(config.sampleRatio),
		}),
		spanProcessors: [new BatchSpanProcessor(traceExporter)],
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

	// --- Auto-instrumentations (patches global fetch) ---
	registerInstrumentations({
		tracerProvider,
		meterProvider,
		loggerProvider,
		instrumentations: [
			new FetchInstrumentation({
				// Never trace our own OTLP export calls — they would recurse into
				// spans about sending spans.
				ignoreUrls: [endpointRegex],
				// Propagate W3C traceparent headers to the collector origin so
				// backend-side work can be correlated with the frontend trace.
				propagateTraceHeaderCorsUrls: [endpointRegex],
			}),
		],
	});

	// --- App-level instrumentation ---
	instrumentRouter(router);
	observeWebVitals();
	captureGlobalErrors();
	observePageLifecycle({
		onHidden: () => {
			void flushTelemetry(tracerProvider, meterProvider, loggerProvider);
		},
	});
}

async function flushTelemetry(
	tracerProvider: WebTracerProvider,
	meterProvider: MeterProvider,
	loggerProvider: LoggerProvider,
): Promise<void> {
	await Promise.allSettled([
		tracerProvider.forceFlush(),
		meterProvider.forceFlush(),
		loggerProvider.forceFlush(),
	]);
}
