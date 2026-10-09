import { Effect, Scope } from "effect";

import { createQueue, type QueueApi } from "@/worker/queue/runtime.ts";

// The module keeps the scope, which is what keeps the scheduler alive for the
// life of the worker. A `Layer` would rebuild the runtime per call.
const runtimeScope = Effect.runSync(Scope.make());
const runtime = Effect.runSync(Scope.provide(runtimeScope)(createQueue()));

export const queue: QueueApi = runtime;

// Worker-side only. A handler is a closure, so `register` never crosses the
// port and a `kind` is only usable in a build where some module registered it.
export const register = runtime.registry.register;

export type { QueueApi } from "@/worker/queue/runtime.ts";
export type {
  EnqueueInput,
  Job,
  JobContext,
  JobHandler,
  JobId,
  JobKind,
  JobState,
  ListFilter,
  QueueConfig,
  WaitOptions,
} from "@/worker/queue/schema.ts";
