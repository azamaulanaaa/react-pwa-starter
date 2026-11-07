import { Effect, Scope } from "effect";

import { dbMain } from "@/worker/db/index.ts";
import { createOutbox } from "@/worker/outbox/runtime.ts";
import { workerScope } from "@/worker/supervisor.ts";

/**
 * The outbox singleton.
 *
 * The worker scope owns the recovery fiber and the flusher fiber. The recovery
 * moves a `sending` row back to `pending`, so a crash during a send does not
 * strand it.
 *
 * A dedicated worker gives each tab its own outbox instance. Two tabs can
 * send one operation at the same time. The operation id is the idempotency
 * key, so the server stores one row. The outbox row id is also the operation
 * id, so a duplicate flush does not create a second row.
 */
const runtime = Effect.runSync(
  Scope.provide(workerScope)(createOutbox({ table: dbMain.outbox })),
);

export const outbox = runtime.api;

// Worker-side only. A handler is a closure, so `register` never crosses the
// port and a `kind` is only usable in a build where some module registered it.
export const register = runtime.registry.register;

export type { OutboxApi } from "@/worker/outbox/runtime.ts";
export type {
  OutboxCounts,
  OutboxEnqueueInput,
  OutboxErrorInfo,
  OutboxFlushResult,
  OutboxHandler,
  OutboxHandlerResult,
  OutboxLocalChange,
  OutboxMethod,
  OutboxOp,
  OutboxState,
  OutboxStatus,
} from "@/lib/outbox/types.ts";
