/**
 * Global error capture.
 *
 * Uncaught exceptions and unhandled rejections are exported as ERROR log
 * records and, when a span is active, recorded on that span as an exception
 * event with error status.
 */
import { trace } from "@opentelemetry/api";
import { emitLog } from "@/telemetry/api.ts";

function describe(error: unknown): {
	message: string;
	stack?: string;
} {
	// Unhandled rejections can nest: { reason: { reason: Error } }.
	let current = error;
	for (
		let depth = 0;
		depth < 3 && current instanceof Object && !(current instanceof Error);
		depth++
	) {
		const nested = (current as { reason?: unknown }).reason;
		if (nested === undefined || nested === null) break;
		current = nested;
	}
	if (current instanceof Error) {
		return { message: current.message, stack: current.stack };
	}
	return { message: String(current ?? "unknown error") };
}

export function captureGlobalErrors(): void {
	window.addEventListener("error", (event) => {
		record(describe(event.error ?? event.message), "uncaught_error");
	});

	window.addEventListener("unhandledrejection", (event) => {
		record(describe(event.reason), "unhandled_rejection");
	});
}

// Rate limiting: an error storm (e.g. a bad retry loop) must not flood the
// log pipeline or the telemetry bill. Fixed-window cap with a one-time
// suppression summary per window.
const MAX_RECORDS_PER_WINDOW = 10;
const WINDOW_MS = 60_000;

let windowStartMs = 0;
let emittedInWindow = 0;
let suppressedInWindow = 0;

function record(
	info: { message: string; stack?: string },
	source: "uncaught_error" | "unhandled_rejection",
): void {
	const nowMs = Date.now();
	if (nowMs - windowStartMs >= WINDOW_MS) {
		if (suppressedInWindow > 0) {
			emitLog("WARN", `${suppressedInWindow} error records suppressed by rate limiter`, {
				"error.suppressed": suppressedInWindow,
			});
			suppressedInWindow = 0;
		}
		windowStartMs = nowMs;
		emittedInWindow = 0;
	}

	if (emittedInWindow >= MAX_RECORDS_PER_WINDOW) {
		suppressedInWindow++;
		return;
	}
	emittedInWindow++;

	emitLog("ERROR", info.message, {
		"error.source": source,
		"error.stack": info.stack,
	});

	// Attach to whatever span is active so the error shows up inline in traces.
	trace
		.getActiveSpan()
		?.recordException(new Error(`${info.message}\n${info.stack ?? ""}`));
}
