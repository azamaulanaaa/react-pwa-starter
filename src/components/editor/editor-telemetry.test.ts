import { metrics } from "@opentelemetry/api";
import {
  MeterProvider,
  MetricReader,
  type ResourceMetrics,
} from "@opentelemetry/sdk-metrics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type EditorEventName,
  recordEditorEvent,
} from "@/components/editor/editor-telemetry.ts";

/** Collects metrics in memory for one test. */
class TestMetricReader extends MetricReader {
  protected async onShutdown(): Promise<void> {}
  protected async onForceFlush(): Promise<void> {}
}

/** Returns one metric from one collection result. */
function findMetric(result: ResourceMetrics, name: string) {
  for (const scope of result.scopeMetrics) {
    const metric = scope.metrics.find((item) => item.descriptor.name === name);

    if (metric !== undefined) return metric;
  }

  return undefined;
}

/** Loads the editor telemetry module after the test sets the provider. */
async function loadTelemetry(): Promise<void> {
  vi.resetModules();
  await import("@/components/editor/editor-telemetry.ts");
}

/** Records one event and returns the collected metric. */
async function recordAndCollect(
  event: EditorEventName,
  attributes?: Record<string, string | number | boolean>,
) {
  const reader = new TestMetricReader();
  const provider = new MeterProvider({ readers: [reader] });
  metrics.setGlobalMeterProvider(provider);
  await loadTelemetry();

  const { recordEditorEvent: record } =
    await import("@/components/editor/editor-telemetry.ts");

  record(event, attributes);

  const result = await reader.collect();

  await provider.shutdown();

  return findMetric(result.resourceMetrics, event);
}

describe("recordEditorEvent", () => {
  beforeEach(() => {
    metrics.disable();
  });

  afterEach(() => {
    metrics.disable();
    vi.resetModules();
  });

  it("does not throw when the provider is a no-op", () => {
    expect(() => {
      recordEditorEvent("editor.markdown.invalid", {
        code: "unsupported_html",
      });
    }).not.toThrow();
  });

  it("adds one to the matching counter for each call", async () => {
    const reader = new TestMetricReader();
    const provider = new MeterProvider({ readers: [reader] });
    metrics.setGlobalMeterProvider(provider);
    await loadTelemetry();

    const { recordEditorEvent: record } =
      await import("@/components/editor/editor-telemetry.ts");

    record("editor.markdown.invalid", { code: "unsupported_html" });
    record("editor.markdown.invalid", { code: "unsupported_html" });

    const result = await reader.collect();
    const metric = findMetric(
      result.resourceMetrics,
      "editor.markdown.invalid",
    );

    expect(metric?.dataPoints[0]?.value).toBe(2);

    await provider.shutdown();
  });

  it("keeps one counter for each event name", async () => {
    const reader = new TestMetricReader();
    const provider = new MeterProvider({ readers: [reader] });
    metrics.setGlobalMeterProvider(provider);
    await loadTelemetry();

    const { recordEditorEvent: record } =
      await import("@/components/editor/editor-telemetry.ts");

    record("editor.upload.failed", { reason: "network" });
    record("editor.link.invalid", { reason: "url" });

    const result = await reader.collect();

    expect(
      findMetric(result.resourceMetrics, "editor.upload.failed")?.dataPoints[0]
        ?.value,
    ).toBe(1);
    expect(
      findMetric(result.resourceMetrics, "editor.link.invalid")?.dataPoints[0]
        ?.value,
    ).toBe(1);

    await provider.shutdown();
  });

  it("does not send Markdown, a URL, a file name, or a user id", async () => {
    const metric = await recordAndCollect("editor.upload.failed", {
      reason: "network",
      markdown: "# Internal notes",
      url: "https://example.com/private",
      fileName: "private.png",
      userId: "user-123",
    });
    const attributes = metric?.dataPoints[0]?.attributes ?? {};
    const values = Object.values(attributes);

    expect(attributes).toEqual({ reason: "network" });
    expect(values.join(" ")).not.toContain("# Internal notes");
    expect(values.join(" ")).not.toContain("https://");
    expect(values.join(" ")).not.toContain("private.png");
    expect(values.join(" ")).not.toContain("user-123");
  });
});
