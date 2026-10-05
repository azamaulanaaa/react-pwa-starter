/**
 * OpenTelemetry bootstrap for the browser.
 *
 * This module loads the OTel SDK and the exporters. It loads them only through
 * a dynamic `import()` in main.tsx. The dynamic import puts the OTel SDK in its
 * own lazy chunk. That chunk never blocks the first paint.
 * See src/telemetry/api.ts for the helpers that support static import.
 */
import { metrics, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  WebTracerProvider,
} from "@opentelemetry/sdk-trace-web";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import {
  defaultResource,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";

import { getMeter, hasTelemetryConsent, sessionId } from "@/telemetry/api.ts";
import { resolveTelemetryConfig } from "@/telemetry/config.ts";
import { instrumentRouter } from "@/telemetry/router.ts";
import {
  observePageLifecycle,
  observeWebVitals,
} from "@/telemetry/web-vitals.ts";
import { captureGlobalErrors } from "@/telemetry/errors.ts";

export interface TelemetryOptions {
  /**
   * The app router instance. The code uses it to emit navigation spans and
   * metrics.
   */
  router: RouterLike;
}

/** The part of the TanStack Router type that the code uses. */
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
 * Register the providers, the exporters, and the instrumentations.
 * The function returns after the registration finishes. A telemetry failure
 * must never break the app, so the caller must swallow such an error.
 */
export function setupTelemetry({ router }: TelemetryOptions): void {
  const config = resolveTelemetryConfig();
  if (!config.enabled) return;
  if (config.requireConsent && !hasTelemetryConsent()) return;

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
        // Never trace our own OTLP export calls. The code does this because the
        // calls would create spans about sending spans.
        ignoreUrls: [endpointRegex],
        // Send the W3C traceparent headers to the collector origin. The
        // backend can then correlate its work with the frontend trace.
        propagateTraceHeaderCorsUrls: [endpointRegex],
      }),
    ],
  });

  // --- App-level instrumentation ---
  instrumentRouter(router);
  observeWebVitals({ meter: getMeter() });
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
