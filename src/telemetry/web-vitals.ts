/**
 * Web vitals and page lifecycle instrumentation.
 *
 * - The code exports each Core Web Vital as a short span. The names are CLS,
 *   INP, LCP, FCP, and TTFB. The code also records each value in the
 *   `app.web_vital.value` histogram metric.
 * - The page lifecycle emits a `page.load` span. The code takes the data for
 *   this span from the Navigation Timing entry. The code logs each visibility
 *   change. The code notifies the caller on hide, so the caller can flush the
 *   data.
 */
import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
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
  /**
   * The code calls this function when the page becomes hidden. This is a good
   * moment to flush the exporters.
   */
  onHidden?: () => void;
  logger?: import("@opentelemetry/api-logs").Logger;
}

export function observePageLifecycle(deps: LifecycleDeps = {}): void {
  const logger = deps.logger;

  globalThis.addEventListener("load", () => {
    setTimeout(() => {
      const [navigation] = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      if (!navigation) return;

      // OTel expects times that are relative to performance.timeOrigin. These
      // times are the same as the values that performance.now() returns. The
      // NavigationTiming entry exposes these times. The code must not add
      // timeOrigin here.
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

  // The browser does not send the visibilitychange event with the state
  // "hidden" when it closes a mobile app. The browser also does not send this
  // event for a navigation to another document. The pagehide event is the
  // reliable signal in these cases.
  globalThis.addEventListener("pagehide", () => {
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
