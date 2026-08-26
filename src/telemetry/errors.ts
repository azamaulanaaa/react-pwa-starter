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

function record(
	info: { message: string; stack?: string },
	source: "uncaught_error" | "unhandled_rejection",
): void {
	emitLog("ERROR", info.message, {
		"error.source": source,
		"error.stack": info.stack,
	});

	// Attach to whatever span is active so the error shows up inline in traces.
	trace
		.getActiveSpan()
		?.recordException(new Error(`${info.message}\n${info.stack ?? ""}`));
}
