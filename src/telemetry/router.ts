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

/**
 * Collapse dynamic-looking segments ("/tasks/42" -> "/tasks/:id") so metric
 * labels and span names stay low-cardinality. Heuristic: purely numeric
 * segments and long hex/uuid-ish segments become ":id". The untouched path
 * remains available on span attributes.
 */
function routePattern(pathname: string): string {
	return pathname
		.split("/")
		.map((segment) =>
			/^\d+$/.test(segment) || /^[0-9a-f-]{16,}$/i.test(segment)
				? ":id"
				: segment,
		)
		.join("/");
}

interface ActiveNavigation {
	span: Span;
	startedAtMs: number;
	pattern: string;
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
			const pattern = routePattern(pathname);
			const span = TRACER.startSpan(`route ${pattern}`, {
				attributes: {
					"http.route": pattern,
					// High-cardinality value — kept on the span only, never on metrics.
					"router.path": pathname,
					"router.path_changed": pathChanged,
				},
			});
			active = { span, startedAtMs: performance.now(), pattern };
		},
	);

	const unsubscribeEnd = router.subscribe("onResolved", ({ toLocation }) => {
		if (!active || active.pattern !== routePattern(toLocation.pathname)) return;
		const durationMs = performance.now() - active.startedAtMs;
		const attrs = { "http.route": active.pattern };

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
