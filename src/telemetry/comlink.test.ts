import { MessageChannel } from "node:worker_threads";
import { describe, expect, it } from "vitest";

import type {
  Attributes,
  Exception,
  Span,
  SpanOptions,
  SpanStatus,
  Tracer,
} from "@opentelemetry/api";
import * as Comlink from "comlink";

import { instrumentWorkerProxy, withWorkerCall } from "@/telemetry/comlink.ts";

interface RecordedSpan {
  name: string;
  options?: SpanOptions;
  status: { code: number; message?: string } | null;
  ended: boolean;
  exceptions: unknown[];
}

/** Minimal recording tracer: captures every span without any OTel machinery. */
const makeFakeTracer = (): { spans: RecordedSpan[]; tracer: Tracer } => {
  const spans: RecordedSpan[] = [];

  const tracer = {
    startSpan(name: string, options?: SpanOptions): Span {
      const record: RecordedSpan = {
        name,
        options,
        status: null,
        ended: false,
        exceptions: [],
      };
      spans.push(record);

      return {
        setAttribute: () => {},
        setAttributes: () => {},
        addEvent: () => {},
        addLink: () => {},
        addLinks: () => {},
        setStatus: (status: SpanStatus) => {
          record.status = status;
        },
        updateName: () => {},
        end: () => {
          record.ended = true;
        },
        isRecording: () => true,
        recordException: (exception: Exception) => {
          record.exceptions.push(exception);
        },
      } as unknown as Span;
    },
  } as unknown as Tracer;

  return { spans, tracer };
};

describe("withWorkerCall", () => {
  it("emits an OK span named after the method and passes the value through", async () => {
    const { spans, tracer } = makeFakeTracer();

    const value = await withWorkerCall(
      { method: "db.task.get" },
      () => Promise.resolve({ id: "t1" }),
      tracer,
    );

    expect(value).toEqual({ id: "t1" });
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe("db.task.get");
    expect(spans[0].status).toEqual({ code: 1 });
    expect(spans[0].ended).toBe(true);
  });

  it("records the exception, sets ERROR status, ends the span, and re-throws", async () => {
    const { spans, tracer } = makeFakeTracer();

    await expect(
      withWorkerCall(
        { method: "db.task.boom" },
        () => Promise.reject(new Error("kaboom")),
        tracer,
      ),
    ).rejects.toThrow("kaboom");

    expect(spans).toHaveLength(1);
    expect(spans[0].status).toEqual({ code: 2, message: "kaboom" });
    expect(spans[0].exceptions[0]).toBeInstanceOf(Error);
    expect(spans[0].ended).toBe(true);
  });

  it("sanitizes arguments into OTel-safe attributes", async () => {
    const { spans, tracer } = makeFakeTracer();

    await withWorkerCall(
      {
        method: "fs.write",
        args: ["file.txt", 42, true, { secret: "payload" }, () => {}],
      },
      () => Promise.resolve(),
      tracer,
    );

    const attributes = spans[0].options?.attributes as Attributes;
    expect(attributes["worker.arg.0"]).toBe("file.txt");
    expect(attributes["worker.arg.1"]).toBe(42);
    expect(attributes["worker.arg.2"]).toBe(true);
    expect(attributes["worker.arg.3"]).toBe("[object]");
    expect(attributes["worker.arg.4"]).toBe("[function]");
  });

  it("caps recorded arguments at eight and records none when absent", async () => {
    const { spans, tracer } = makeFakeTracer();

    await withWorkerCall(
      { method: "m", args: Array.from({ length: 10 }, (_, i) => i) },
      () => Promise.resolve(),
      tracer,
    );
    await withWorkerCall({ method: "m" }, () => Promise.resolve(), tracer);

    const withArgs = spans[0].options?.attributes as Attributes;
    expect(
      Object.keys(withArgs).filter((k) => k.startsWith("worker.arg")),
    ).toHaveLength(8);
    expect(withArgs["worker.arg.7"]).toBe(7);

    const withoutArgs = spans[1].options?.attributes as Attributes;
    expect(Object.keys(withoutArgs)).toHaveLength(0);
  });
});

describe("instrumentWorkerProxy", () => {
  const endpoint = (port: unknown) => port as unknown as Comlink.Endpoint;

  interface TaskApi {
    get: (id: string) => Promise<{ id: string; done: boolean }>;
    boom: () => Promise<never>;
  }

  interface RemoteApi {
    db: { task: TaskApi };
  }

  const makeRemote = (tracer: Tracer): RemoteApi => {
    const api = {
      db: {
        task: {
          get: (id: string) => Promise.resolve({ id, done: false }),
          boom: () => Promise.reject(new Error("kaboom")),
        },
      },
    };

    const { port1, port2 } = new MessageChannel();
    Comlink.expose(api, endpoint(port1));
    return instrumentWorkerProxy(
      Comlink.wrap(endpoint(port2)) as unknown as RemoteApi,
      tracer,
    );
  };

  it("spans a nested call across a real comlink round-trip", async () => {
    const { spans, tracer } = makeFakeTracer();
    const remote = makeRemote(tracer);

    const task = await remote.db.task.get("t1");

    expect(task.id).toBe("t1");
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe("db.task.get");
    expect(spans[0].status).toEqual({ code: 1 });
    expect(spans[0].ended).toBe(true);
  });

  it("records remote errors with the dotted method name", async () => {
    const { spans, tracer } = makeFakeTracer();
    const remote = makeRemote(tracer);

    await expect(remote.db.task.boom()).rejects.toThrow("kaboom");

    expect(spans.map((s) => s.name)).toEqual(["db.task.boom"]);
    expect(spans[0].status).toEqual({ code: 2, message: "kaboom" });
    expect(spans[0].ended).toBe(true);
  });

  it("emits one span per call", async () => {
    const { spans, tracer } = makeFakeTracer();
    const remote = makeRemote(tracer);

    await remote.db.task.get("a");
    await remote.db.task.get("b");

    expect(spans.map((s) => s.name)).toEqual(["db.task.get", "db.task.get"]);
  });

  it("caches wrapped members so identities stay stable", () => {
    const { tracer } = makeFakeTracer();
    const remote = makeRemote(tracer);

    expect(remote.db).toBe(remote.db);
    expect(remote.db.task.get).toBe(remote.db.task.get);
  });

  it("passes `then` and symbol keys through untouched", () => {
    const { spans, tracer } = makeFakeTracer();
    const remote = makeRemote(tracer) as unknown as Record<
      PropertyKey,
      unknown
    >;

    // Comlink's root `then` is a sticky thenable ({ then: () => proxy }) that
    // must keep stock semantics — passed through, never wrapped or spanned.
    const thenable = remote.then as { then: unknown };
    expect(typeof thenable).toBe("object");
    expect(typeof thenable.then).toBe("function");

    // Symbol keys pass through to the wrapped node verbatim (comlink answers
    // with its own sub-proxies; plain objects answer with the raw value).
    const tagged = instrumentWorkerProxy(
      { [Symbol.toStringTag]: "raw-tag" },
      tracer,
    ) as Record<PropertyKey, unknown>;
    expect(tagged[Symbol.toStringTag]).toBe("raw-tag");

    // Neither kind of access may emit a span.
    expect(spans).toHaveLength(0);
  });
});
