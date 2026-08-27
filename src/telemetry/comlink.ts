/**
 * Instrument calls into the worker (Comlink proxies) with a span that brackets
 * each message round-trip.
 *
 * The OTel providers are registered on the main/UI thread by setupTelemetry()
 * in src/telemetry/index.ts, so this instrumentation lives there too — never in
 * the worker. That avoids duplicating an SDK per tab and keeps every span on a
 * single trace tree that already contains navigation/web-vital spans.
 *
 * The comlink proxy mechanics (callable proxies, path accumulation, thenable
 * passthrough) live in src/lib/comlink/intercept.ts; this file is only the
 * OTel adapter that records a span per intercepted call.
 *
 * Before setupTelemetry() runs (or when it is disabled / consent-pending) the
 * global tracer provider is not registered, so getTracer() resolves to OTel's
 * no-op tracer and every span below becomes a cheap no-op automatically. Callers
 * therefore never need state checks.
 */
import type { Attributes, Span, Tracer } from "@opentelemetry/api";

import {
  interceptProxy,
  type ProxyCallInterceptor,
} from "@/lib/comlink/index.ts";
import { getTracer } from "@/telemetry/api.ts";

export interface WorkerCallContext {
  /** Dotted method path for the span name, e.g. "db.task.get" or "fs.Upload". */
  method: string;
  /** Positional call arguments; sanitized into OTel-safe span attributes. */
  args?: readonly unknown[];
  /** Extra attributes merged after the sanitized argument attributes. */
  attributes?: Attributes;
}

function recordError(span: Span, error: unknown): void {
  // OTel's Exception type is `string | Error` — normalize before recording.
  const exception = error instanceof Error ? error : String(error);
  span.recordException(exception);
  const message = error instanceof Error ? error.message : String(error);
  span.setStatus({ code: 2, /* SpanStatusCode.ERROR */ message });
}

/**
 * Coerce positional arguments into valid OTel attribute values. Only primitives
 * are kept verbatim; anything else degrades to a type tag so payloads (which
 * may contain user data or cyclic structures) never reach an exporter.
 */
function argAttributes(args: readonly unknown[] | undefined): Attributes {
  const out: Attributes = {};
  if (!args?.length) return out;
  for (const [index, arg] of args.slice(0, 8).entries()) {
    const type = typeof arg;
    out[`worker.arg.${index}`] =
      type === "string" || type === "number" || type === "boolean"
        ? (arg as string | number | boolean)
        : `[${type}]`;
  }
  return out;
}

/**
 * Wrap an async worker call in a span. `fn` is the proxied method; we attach
 * outcome + boundary attributes, record exceptions on the span (re-throwing so
 * behaviour is unchanged for callers), and set OK/ERROR status. The tracer is
 * injectable for tests; by default it resolves the global provider.
 */
export function withWorkerCall<T>(
  context: WorkerCallContext,
  fn: () => Promise<T>,
  tracer: Tracer = getTracer(),
): Promise<T> {
  const span = tracer.startSpan(context.method, {
    attributes: { ...argAttributes(context.args), ...context.attributes },
  });
  return fn().then(
    (value) => {
      span.setStatus({ code: 1 /* SpanStatusCode.OK */ });
      span.end();
      return value;
    },
    (error) => {
      recordError(span, error);
      span.end();
      throw error;
    },
  );
}

/**
 * Return an instrumented view of a Comlink-wrapped worker proxy. Every method
 * call is wrapped in a span named after its dotted path (e.g. "db.task.get",
 * "fs.Upload"), so all cross-boundary calls become observable without touching
 * any call site. The tracer is injectable for tests; production callers omit
 * it and the global provider resolves per call (no-op until telemetry starts).
 */
export function instrumentWorkerProxy<T extends object>(
  proxy: T,
  tracer?: Tracer,
): T {
  const intercept: ProxyCallInterceptor = (path, args, next) =>
    withWorkerCall(
      { method: path || "worker", args },
      () => next() as Promise<unknown>,
      tracer ?? getTracer(),
    );
  return interceptProxy(proxy, intercept);
}
