/**
 * TanStack Router instrumentation.
 *
 * The code records a span for each navigation. The span covers the route
 * matching, the loaders, and the resolution. The code also records a navigation
 * counter and a duration histogram.
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
 * Replace each dynamic segment in a path with `":id"`. The code changes
 * `"/tasks/42"` into `"/tasks/:id"`. Then the metric labels and the span names
 * keep a low cardinality.
 * The code uses a heuristic. The code replaces a segment that contains only
 * digits. The code also replaces a long hex or uuid-like segment. The span
 * attributes keep the original path.
 */
function routePattern(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) =>
      /^\d+$/.test(segment) || /^[0-9a-f-]{16,}$/i.test(segment)
        ? ":id"
        : segment
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
        // A later navigation replaces the active navigation before it resolves.
        active.span.setAttribute("router.interrupted", true);
        active.span.end();
      }
      const pathname = toLocation.pathname;
      const pattern = routePattern(pathname);
      const span = TRACER.startSpan(`route ${pattern}`, {
        attributes: {
          "http.route": pattern,
          // The path has a high cardinality. The code sets it on the span only.
          // The code never sets it on metrics.
          "router.path": pathname,
          "router.path_changed": pathChanged,
        },
      });
      active = { span, startedAtMs: performance.now(), pattern };
    },
  );

  const unsubscribeEnd = router.subscribe("onResolved", ({ toLocation }) => {
    if (!active) return;
    const resolvedPattern = routePattern(toLocation.pathname);
    if (active.pattern !== resolvedPattern) {
      // A redirect or an alias resolves to another route. The original load is
      // then done. The code ends the span instead of keeping the span open
      // until the next navigation. The code sets the pattern of the original
      // start in the `router.redirected` attribute.
      active.span.setAttribute("router.redirected", resolvedPattern);
      active.span.end();
      active = undefined;
      return;
    }
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
