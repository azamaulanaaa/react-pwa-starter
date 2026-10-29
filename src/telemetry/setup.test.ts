// @vitest-environment jsdom
/**
 * The build-time gate turns telemetry off in test mode, so stub the config
 * module and exercise the SDK registration directly. The endpoint points at a
 * closed port; the batch exporters fail in the background and the test does
 * not depend on a collector.
 */
import { context, logs, metrics, propagation, trace } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/telemetry/config.ts", () => ({
  resolveTelemetryConfig: () => ({
    enabled: true,
    endpoint: "http://127.0.0.1:1",
    serviceName: "smoke-app",
    environment: "development",
    sampleRatio: 1,
    metricExportIntervalMs: 30_000,
    requireConsent: false,
  }),
  isEnabledAtBuildTime: () => true,
}));

describe("setupTelemetry", () => {
  it("registers providers, context, and propagators", async () => {
    const { setupTelemetry } = await import("@/telemetry/index.ts");
    const { emitLog, getLogger, getTracer } =
      await import("@/telemetry/api.ts");

    // Vitest 5 registers its own global tracer provider, and the OTel API
    // rejects an override. Clear the globals first so this test observes the
    // app's registration.
    trace.disable();
    context.disable();
    propagation.disable();
    logs.disable();
    metrics.disable();
    setupTelemetry({ router: { subscribe: () => () => {} } });

    const span = getTracer("smoke").startSpan("smoke");
    expect(span.isRecording()).toBe(true);
    span.end();

    expect(context.active()).toBeDefined();
    expect(propagation.fields()).toEqual(
      expect.arrayContaining(["traceparent", "tracestate", "baggage"]),
    );

    expect(getLogger("smoke")).toBeDefined();
    expect(() =>
      emitLog("INFO", "smoke", { "smoke.test": true }),
    ).not.toThrow();
  });
});
