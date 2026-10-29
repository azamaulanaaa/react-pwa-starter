import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  EnqueueInputSchema,
  JobSchema,
  QueueConfigSchema,
  resolveConfig,
} from "@/worker/queue/schema.ts";

const job = {
  id: "job-1",
  kind: "upload",
  payload: null,
  state: "queued",
  progress: 0,
  attempt: 1,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  result: null,
  error: null,
} as unknown as Schema.Schema.Type<typeof JobSchema>;

describe("resolveConfig", () => {
  it("fills the defaults 2 and 64", () => {
    expect(resolveConfig()).toEqual({ concurrency: 2, capacity: 64 });
    expect(QueueConfigSchema).toBeDefined();
  });

  it("honours a partial override", () => {
    expect(resolveConfig({ concurrency: 5 })).toEqual({
      concurrency: 5,
      capacity: 64,
    });
    expect(resolveConfig({ capacity: 1 })).toEqual({
      concurrency: 2,
      capacity: 1,
    });
    expect(resolveConfig({ concurrency: 3, capacity: 7 })).toEqual({
      concurrency: 3,
      capacity: 7,
    });
  });
});

describe("JobSchema", () => {
  it("rejects a state outside the six literals", () => {
    expect(() =>
      Schema.decodeUnknownSync(JobSchema)({ ...job, state: "cancelled" }),
    ).toThrow();
  });

  it("accepts each of the six states", () => {
    for (const state of [
      "queued",
      "running",
      "paused",
      "succeeded",
      "failed",
      "canceled",
    ]) {
      expect(Schema.decodeUnknownSync(JobSchema)({ ...job, state }).state).toBe(
        state,
      );
    }
  });

  it("rejects a progress below 0 and above 1", () => {
    expect(() =>
      Schema.decodeUnknownSync(JobSchema)({ ...job, progress: -0.1 }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(JobSchema)({ ...job, progress: 1.1 }),
    ).toThrow();
    const progress0 = Schema.decodeUnknownSync(JobSchema)({
      ...job,
      progress: 0,
    });
    const progress1 = Schema.decodeUnknownSync(JobSchema)({
      ...job,
      progress: 1,
    });
    expect(progress0.progress).toBe(0);
    expect(progress1.progress).toBe(1);
  });

  it("rejects a non-finite progress", () => {
    expect(() =>
      Schema.decodeUnknownSync(JobSchema)({ ...job, progress: Number.NaN }),
    ).toThrow();
  });

  it("rejects an attempt below 1 or a non-integer attempt", () => {
    expect(() =>
      Schema.decodeUnknownSync(JobSchema)({ ...job, attempt: 0 }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(JobSchema)({ ...job, attempt: 1.5 }),
    ).toThrow();
  });
});

describe("EnqueueInputSchema", () => {
  it("accepts a missing payload", () => {
    const decoded = Schema.decodeUnknownSync(EnqueueInputSchema)({
      kind: "upload",
    });
    expect(decoded.kind).toBe("upload");
  });

  it("rejects a missing kind and an empty kind", () => {
    expect(() => Schema.decodeUnknownSync(EnqueueInputSchema)({})).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(EnqueueInputSchema)({ kind: "" }),
    ).toThrow();
  });
});
