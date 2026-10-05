/**
 * Lightweight telemetry helpers. Import them statically anywhere in app code.
 * They do not add the heavy OTel SDK to the initial bundle.
 *
 * Before `setupTelemetry()` runs, or if telemetry is disabled, these helpers
 * call the OTel API globals. These globals are no-ops. Call sites never check
 * state.
 */
import { type Attributes, metrics, type Span, trace } from "@opentelemetry/api";
import { type LogAttributes, logs } from "@opentelemetry/api-logs";

export const TELEMETRY_SCOPE = "react-pwa-starter";

export function getTracer(scope = TELEMETRY_SCOPE) {
  return trace.getTracer(scope);
}

export function getMeter(scope = TELEMETRY_SCOPE) {
  return metrics.getMeter(scope);
}

export function getLogger(scope = TELEMETRY_SCOPE) {
  return logs.getLogger(scope);
}

const SEVERITY_NUMBERS = {
  INFO: 9, // SeverityNumber.INFO
  WARN: 13, // SeverityNumber.WARN
  ERROR: 17, // SeverityNumber.ERROR
} as const;

/** Emit a structured log record to the configured log pipeline. */
export function emitLog(
  severityText: keyof typeof SEVERITY_NUMBERS,
  body: string,
  attributes?: LogAttributes,
): void {
  getLogger().emit({
    body,
    severityNumber: SEVERITY_NUMBERS[severityText],
    severityText,
    attributes,
  });
}

/**
 * Run an operation in an active span. The operation can be a sync function or
 * an async function. The span records each error. The function re-throws each
 * error.
 */
export function withSpan<T>(
  name: string,
  fn: (span: Span) => T | Promise<T>,
  attributes?: Attributes,
): T | Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, { attributes }, (span: Span) => {
    let result: T | Promise<T>;
    try {
      result = fn(span);
    } catch (error) {
      recordErrorOnSpan(span, error);
      span.end();
      throw error;
    }
    if (result instanceof Promise) {
      return result.then(
        (value) => {
          span.end();
          return value;
        },
        (rejection) => {
          recordErrorOnSpan(span, rejection);
          span.end();
          throw rejection;
        },
      );
    }
    span.end();
    return result;
  });
}

function recordErrorOnSpan(span: Span, error: Error | unknown): void {
  // OTel's Exception type is string | Error. The code normalizes the value
  // before recording it.
  const exception = error instanceof Error ? error : String(error);
  span.recordException(exception);
  const message = error instanceof Error ? error.message : String(error);
  span.setStatus({ code: 2, /* SpanStatusCode.ERROR */ message });
}

/**
 * Return a stable id for the current session. The backend can correlate all
 * signals from one browser session with this id.
 */
export function sessionId(): string {
  try {
    let id = sessionStorage.getItem("otel_session_id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("otel_session_id", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// --- Consent gate ---
// Apps with privacy requirements, such as GDPR, can set
// VITE_OTEL_REQUIRE_CONSENT. These apps call setTelemetryConsent(true) after
// the user opts in. Until then, setupTelemetry() refuses to start and all
// helpers remain no-ops. Nothing is collected or exported before the consent.
let consentGranted = false;

export function setTelemetryConsent(granted: boolean): void {
  consentGranted = granted;
}

export function hasTelemetryConsent(): boolean {
  return consentGranted;
}
