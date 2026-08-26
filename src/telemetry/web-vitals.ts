/**
 * Web vitals + page lifecycle instrumentation.
 *
 * - Each Core Web Vital (CLS, INP, LCP, FCP, TTFB) is exported as a short
 *   span and recorded in the `app.web_vital.value` histogram metric.
 * - Page lifecycle emits a `page.load` span derived from the Navigation Timing
 *   entry, logs visibility changes, and notifies on hide for flushing.
 */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { trace } from "@opentelemetry/api";

const TRACER = trace.getTracer("web-vitals");

interface WebVitalsDeps {
	meter?: import("@opentelemetry/api").Meter;
}

export function observeWebVitals(deps: WebVitalsDeps = {}): void {
	const histogram = deps.meter?.createHistogram("app.web_vital.value", {
		description: "Web vital measurement value by vital name.",
		unit: "ms",
	});

	const report = (metric: Metric) => {
		const attributes = {
			"web_vital.name": metric.name,
			"web_vital.rating": metric.rating,
		};
		histogram?.record(metric.value, attributes);

		const span = TRACER.startSpan(`web_vital ${metric.name}`, {
			attributes: {
				...attributes,
				"web_vital.value": metric.value,
				"web_vital.id": metric.id,
				...(metric.navigationType && {
					"web_vital.navigation_type": metric.navigationType,
				}),
			},
		});
		span.end();
	};

	onCLS(report);
	onINP(report);
	onLCP(report);
	onFCP(report);
	onTTFB(report);
}

interface LifecycleDeps {
	/** Called when the page becomes hidden — good moment to flush exporters. */
	onHidden?: () => void;
	logger?: import("@opentelemetry/api-logs").Logger;
}

export function observePageLifecycle(deps: LifecycleDeps = {}): void {
	const logger = deps.logger;

	window.addEventListener("load", () => {
		setTimeout(() => {
			const [navigation] = performance.getEntriesByType(
				"navigation",
			) as PerformanceNavigationTiming[];
			if (!navigation) return;

			// OTel expects times relative to performance.timeOrigin (i.e.
			// performance.now()-style values), which is exactly what the
			// NavigationTiming entry exposes — do NOT add timeOrigin here.
			const span = TRACER.startSpan("page.load", {
				startTime: navigation.startTime,
			});
			span.setAttributes({
				"page.ttfb_ms": Math.round(navigation.responseStart),
				"page.dom_interactive_ms": Math.round(navigation.domInteractive),
				"page.dom_content_loaded_ms": Math.round(
					navigation.domContentLoadedEventEnd,
				),
				"page.load_event_ms": Math.round(navigation.loadEventEnd),
				"page.type": navigation.type,
			});
			span.end(navigation.loadEventEnd);
		}, 0);
	});

	// visibilitychange->hidden does not fire on mobile app kill or
	// cross-document navigation; pagehide is the reliable last-resort signal.
	window.addEventListener("pagehide", () => {
		deps.onHidden?.();
	});

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			deps.onHidden?.();
			logger?.emit({
				body: "page hidden",
				severityNumber: 9,
				severityText: "INFO",
				attributes: { "event.name": "page.hidden" },
			});
		} else {
			logger?.emit({
				body: "page visible",
				severityNumber: 9,
				severityText: "INFO",
				attributes: { "event.name": "page.visible" },
			});
		}
	});
}
