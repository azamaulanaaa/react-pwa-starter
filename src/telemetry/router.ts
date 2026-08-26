/**
 * TanStack Router instrumentation.
 *
 * Each navigation gets a span covering route matching + loaders + resolution,
 * plus a navigation counter and duration histogram as metrics.
 */
import { metrics, trace } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";

const TRACER = trace.getTracer("router");
const METER = metrics.getMeter("router");

interface RouterLike {
	subscribe: (
		eventType: "onBeforeLoad" | "onResolved",
		fn: (event: {
			toLocation: { pathname: string };
			pathChanged: boolean;
		}) => void,
	) => () => void;
}

interface ActiveNavigation {
	span: Span;
	startedAtMs: number;
	pathname: string;
}

export function instrumentRouter(router: RouterLike): () => void {
	const navigations = METER.createCounter("app.router.navigations", {
		description: "Count of router navigations by destination path.",
	});
	const navigationDuration = METER.createHistogram(
		"app.router.navigation.duration",
		{ description: "Route load duration in ms.", unit: "ms" },
	);

	let active: ActiveNavigation | undefined;

	const unsubscribeStart = router.subscribe(
		"onBeforeLoad",
		({ toLocation, pathChanged }) => {
			if (active) {
				// Previous navigation was superseded before it resolved.
				active.span.setAttribute("router.interrupted", true);
				active.span.end();
			}
			const pathname = toLocation.pathname;
			const span = TRACER.startSpan(`route ${pathname}`, {
				attributes: {
					"http.route": pathname,
					"router.path_changed": pathChanged,
				},
			});
			active = { span, startedAtMs: performance.now(), pathname };
		},
	);

	const unsubscribeEnd = router.subscribe("onResolved", ({ toLocation }) => {
		if (!active || active.pathname !== toLocation.pathname) return;
		const durationMs = performance.now() - active.startedAtMs;
		const attrs = { "http.route": active.pathname };

		active.span.setAttributes({
			"router.duration_ms": Math.round(durationMs),
		});
		active.span.end();

		navigations.add(1, attrs);
		navigationDuration.record(durationMs, attrs);
		active = undefined;
	});

	return () => {
		unsubscribeStart();
		unsubscribeEnd();
	};
}
