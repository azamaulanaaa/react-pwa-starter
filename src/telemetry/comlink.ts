/**
 * Record a span for each call into the worker. Each span covers one message
 * round-trip to a Comlink proxy.
 *
 * `setupTelemetry()` in src/telemetry/index.ts registers the OTel providers on
 * the main thread. This instrumentation runs on the main thread too. Never run
 * this instrumentation in the worker. Each tab then loads only one SDK. Every
 * span then stays in one trace tree with the navigation and web-vital spans.
 *
 * src/lib/comlink/intercept.ts holds the Comlink proxy mechanics. That file
 * handles the callable proxies, the path accumulation, and the thenable
 * passthrough. This file only records a span for each intercepted call.
 *
 * The global tracer provider is not registered before `setupTelemetry()` runs.
 * The provider is also not registered when telemetry is disabled or waits for
 * consent. Then `getTracer()` returns the OTel no-op tracer. Every span below
 * becomes a no-op at no cost. Callers never check state.
 */
import type { Attributes, Span, Tracer } from "@opentelemetry/api";

import {
  interceptProxy,
  type ProxyCallInterceptor,
} from "@/lib/comlink/index.ts";
import { getTracer } from "@/telemetry/api.ts";

export interface WorkerCallContext {
  /**
   * The dotted method path for the span name, such as `"db.task.get"` or
   * `"fs.Upload"`.
   */
  method: string;
  /**
   * The positional call arguments. The code sanitizes them into span attributes
   * that OTel accepts.
   */
  args?: readonly unknown[];
  /**
   * Extra attributes. The code merges them after the sanitized argument
   * attributes.
   */
  attributes?: Attributes;
}

function recordError(span: Span, error: unknown): void {
  // OTel's Exception type is `string | Error`. The code normalizes the value
  // before recording it.
  const exception = error instanceof Error ? error : String(error);
  span.recordException(exception);
  const message = error instanceof Error ? error.message : String(error);
  span.setStatus({ code: 2, /* SpanStatusCode.ERROR */ message });
}

/**
 * Change the positional arguments into values that OTel accepts as attributes.
 * The code keeps each primitive value unchanged. The code replaces each other
 * value with a type tag. A payload can contain user data or a cyclic structure.
 * The code prevents such a payload from reaching an exporter.
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
 * Record a span for one async worker call. `fn` is the proxied method.
 * The function adds the outcome attributes and the boundary attributes.
 * The function records each exception on the span. The function re-throws the
 * exception, so the behaviour stays the same for the callers. The function sets
 * the `OK` status or the `ERROR` status. Tests can inject the tracer. By
 * default the tracer uses the global provider.
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
 * Return a new view of a Comlink worker proxy. The view records a span for each
 * method call. The span name is the dotted path of the method, such as
 * `"db.task.get"` or `"fs.Upload"`. Then each call across the boundary is
 * observable, and the code does not change any call site. Tests can inject the
 * tracer. Production callers omit the tracer. The function uses the global
 * provider for each call. The provider is a no-op until the telemetry starts.
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
