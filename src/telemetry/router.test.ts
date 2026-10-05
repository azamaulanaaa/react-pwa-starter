import { describe, expect, it, vi } from "vitest";
import { metrics, trace } from "@opentelemetry/api";
import type {
  Counter,
  Histogram,
  Meter,
  Span,
  SpanOptions,
  Tracer,
} from "@opentelemetry/api";

type RouterEvent = {
  toLocation: { pathname: string };
  pathChanged: boolean;
};

type Subscriber = (event: RouterEvent) => void;

interface RecordedSpan {
  name: string;
  options?: SpanOptions;
  attributes: Record<string, unknown>;
  ended: boolean;
}

const makeFakeTracer = (): {
  spans: RecordedSpan[];
  tracer: Tracer;
} => {
  const spans: RecordedSpan[] = [];
  const tracer = {
    startSpan(name: string, options?: SpanOptions): Span {
      const record: RecordedSpan = {
        name,
        options,
        attributes: { ...(options?.attributes ?? {}) },
        ended: false,
      };
      spans.push(record);

      return {
        setAttribute: (key: string, value: unknown) => {
          record.attributes[key] = value;
        },
        setAttributes: (attrs: Record<string, unknown>) => {
          Object.assign(record.attributes, attrs);
        },
        addEvent: () => {},
        addLink: () => {},
        addLinks: () => {},
        setStatus: () => {},
        updateName: () => {},
        end: () => {
          record.ended = true;
        },
        isRecording: () => true,
        recordException: () => {},
      } as unknown as Span;
    },
  } as unknown as Tracer;

  return { spans, tracer };
};

const makeFakeMeter = (): {
  counts: { name: string; value: number; attributes?: unknown }[];
  records: { name: string; value: number; attributes?: unknown }[];
  meter: Meter;
} => {
  const counts: { name: string; value: number; attributes?: unknown }[] = [];
  const records: { name: string; value: number; attributes?: unknown }[] = [];

  const meter = {
    createCounter(name: string) {
      return {
        add: (value: number, attributes?: unknown) => {
          counts.push({ name, value, attributes });
        },
      } as unknown as Counter;
    },
    createHistogram(name: string) {
      return {
        record: (value: number, attributes?: unknown) => {
          records.push({ name, value, attributes });
        },
      } as unknown as Histogram;
    },
  } as unknown as Meter;

  return { counts, records, meter };
};

/**
 * Register the fakes and then import `@/telemetry/router.ts` again. The module
 * reads `TRACER` and `METER` at import time. The code must install the spies
 * before it imports the module. Otherwise the module uses the real no-op
 * providers.
 */
const withOtel = async <T>(run: (ctx: {
  spans: RecordedSpan[];
  counts: { name: string; value: number; attributes?: unknown }[];
  records: { name: string; value: number; attributes?: unknown }[];
  instrumentRouter: typeof import("@/telemetry/router.ts").instrumentRouter;
}) => T | Promise<T>): Promise<T> => {
  const tracerFixture = makeFakeTracer();
  const meterFixture = makeFakeMeter();
  const tracerSpy = vi.spyOn(trace, "getTracer").mockReturnValue(
    tracerFixture.tracer,
  );
  const meterSpy = vi.spyOn(metrics, "getMeter").mockReturnValue(
    meterFixture.meter,
  );
  vi.resetModules();

  try {
    const { instrumentRouter } = await import("@/telemetry/router.ts");

    return await run({
      spans: tracerFixture.spans,
      counts: meterFixture.counts,
      records: meterFixture.records,
      instrumentRouter,
    });
  } finally {
    tracerSpy.mockRestore();
    meterSpy.mockRestore();
  }
};

const makeFakeRouter = () => {
  const subscribers: Record<string, Subscriber[]> = {
    onBeforeLoad: [],
    onResolved: [],
  };

  return {
    subscribers,
    subscribe: (eventType: "onBeforeLoad" | "onResolved", fn: Subscriber) => {
      subscribers[eventType].push(fn);
      return () => {
        subscribers[eventType] = subscribers[eventType].filter(
          (s) => s !== fn,
        );
      };
    },
    beforeLoad: (pathname: string, pathChanged = true) =>
      subscribers.onBeforeLoad.forEach((s) =>
        s({ toLocation: { pathname }, pathChanged })
      ),
    resolved: (pathname: string) =>
      subscribers.onResolved.forEach((s) =>
        s({ toLocation: { pathname }, pathChanged: true })
      ),
  };
};
describe("instrumentRouter", () => {
  it("replaces dynamic segments to keep the metric cardinality low", async () => {
    await withOtel(({ spans, counts, instrumentRouter }) => {
      const router = makeFakeRouter();
      instrumentRouter(router);

      router.beforeLoad("/tasks/42");
      router.resolved("/tasks/42");
      router.beforeLoad("/tasks/0192f3a4-5b6c-7d8e-9f01-234567890abc");
      router.resolved("/tasks/0192f3a4-5b6c-7d8e-9f01-234567890abc");

      expect(spans.map((s) => s.name)).toEqual([
        "route /tasks/:id",
        "route /tasks/:id",
      ]);
      // The span keeps the raw path, which has a high cardinality. The metrics
      // never use this path.
      expect(spans[0].attributes["router.path"]).toBe("/tasks/42");
      expect(counts.map((c) => c.attributes)).toEqual([
        { "http.route": "/tasks/:id" },
        { "http.route": "/tasks/:id" },
      ]);
    });
  });

  it("ends the span and records the duration for a normal navigation", async () => {
    await withOtel(({ spans, counts, records, instrumentRouter }) => {
      const router = makeFakeRouter();
      instrumentRouter(router);

      router.beforeLoad("/home", true);
      router.resolved("/home");

      expect(spans[0].ended).toBe(true);
      expect(typeof spans[0].attributes["router.duration_ms"]).toBe("number");
      expect(spans[0].attributes["router.path_changed"]).toBe(true);
      expect(counts).toHaveLength(1);
      expect(records).toHaveLength(1);
      expect(records[0].name).toBe("app.router.navigation.duration");
    });
  });

  it("marks a replaced navigation as interrupted and ends its span", async () => {
    await withOtel(({ spans, instrumentRouter }) => {
      const router = makeFakeRouter();
      instrumentRouter(router);

      router.beforeLoad("/tasks/1");
      router.beforeLoad("/tasks/2");

      expect(spans[0].ended).toBe(true);
      expect(spans[0].attributes["router.interrupted"]).toBe(true);
      expect(spans[1].ended).toBe(false);

      // The active span ends at its own resolution.
      router.resolved("/tasks/2");
      expect(spans[1].ended).toBe(true);
    });
  });

  it("ends the span instead of leaving it open on a redirect", async () => {
    await withOtel(({ spans, counts, instrumentRouter }) => {
      const router = makeFakeRouter();
      instrumentRouter(router);

      router.beforeLoad("/old");
      router.resolved("/new");

      expect(spans).toHaveLength(1);
      expect(spans[0].ended).toBe(true);
      expect(spans[0].attributes["router.redirected"]).toBe("/new");
      // A redirect is not a complete navigation. The code records no counter.
      expect(counts).toHaveLength(0);
    });
  });

  it("ignores a resolution with no matching navigation in progress", async () => {
    await withOtel(({ spans, counts, instrumentRouter }) => {
      const router = makeFakeRouter();
      instrumentRouter(router);

      router.resolved("/orphan");

      expect(spans).toHaveLength(0);
      expect(counts).toHaveLength(0);
    });
  });

  it("unsubscribes both handlers on dispose", async () => {
    await withOtel(({ instrumentRouter }) => {
      const router = makeFakeRouter();
      const dispose = instrumentRouter(router);

      expect(router.subscribers.onBeforeLoad).toHaveLength(1);
      expect(router.subscribers.onResolved).toHaveLength(1);

      dispose();

      expect(router.subscribers.onBeforeLoad).toHaveLength(0);
      expect(router.subscribers.onResolved).toHaveLength(0);
    });
  });
});
