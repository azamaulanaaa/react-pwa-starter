/**
 * Lightweight telemetry helpers — safe to import statically anywhere in app
 * code without pulling the heavy OTel SDK into the initial bundle.
 *
 * Before `setupTelemetry()` runs (or if it is disabled) these proxy the OTel
 * API globals, which are no-ops — so call sites never need to check state.
 */
import { metrics, trace, type Attributes, type Span } from "@opentelemetry/api";
import { logs, type LogAttributes } from "@opentelemetry/api-logs";

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
 * Wrap an operation in an active span. Works for sync and async functions.
 * Errors are recorded on the span and re-thrown.
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
	// OTel's Exception type is string | Error — normalize before recording.
	const exception = error instanceof Error ? error : String(error);
	span.recordException(exception);
	const message = error instanceof Error ? error.message : String(error);
	span.setStatus({ code: 2 /* SpanStatusCode.ERROR */, message });
}

/**
 * A stable per-session id so all signals from one browser session can be
 * correlated in the backend.
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
