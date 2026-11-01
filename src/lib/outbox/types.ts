/** Defines the HTTP method of one outbox operation. */
export type OutboxMethod = "PUT" | "POST" | "PATCH" | "DELETE";

/** Defines the state of one outbox operation. */
export type OutboxState =
  "pending" | "sending" | "failed" | "conflict" | "done";

/** Defines the last error of one outbox operation. */
export type OutboxErrorInfo = {
  /** The stable error code. The code comes from the response envelope. */
  code: string;
  /** The message for the local log. */
  message: string;
};

/**
 * Defines one durable write.
 * The id is also the idempotency key, so a second send is safe.
 */
export type OutboxOp = {
  /** The UUIDv7. The caller sends it as the idempotency key. */
  id: string;
  /** The handler key, for example `example.write.create`. */
  kind: string;
  /** The HTTP method. */
  method: OutboxMethod;
  /** The request path. */
  path: string;
  /** The request body. */
  body: unknown;
  /** The server-corrected time in UTC milliseconds. */
  createdAt: number;
  /** The number of send attempts. */
  attempts: number;
  /** The time of the next attempt in UTC milliseconds. */
  nextAttemptAt: number;
  /** The current state. */
  state: OutboxState;
  /** The last error. The value is absent before the first failure. */
  lastError?: OutboxErrorInfo;
};

/**
 * Defines one local row change.
 * The worker writes the change with the outbox record in one transaction.
 */
export type OutboxLocalChange =
  | { kind: "set"; table: string; id: string; value: unknown }
  | { kind: "delete"; table: string; id: string };

/**
 * Defines the result of one handler call.
 * A handler returns this value for an HTTP response.
 * A handler throws for a network error.
 */
export type OutboxHandlerResult = {
  /** The HTTP status code. */
  status: number;
  /** The optional error code from the response envelope. */
  code?: string;
  /** The optional message that the row keeps. */
  message?: string;
  /** The optional response body. */
  body?: unknown;
  /** The local row changes that commit with the removal of the row. */
  local?: readonly OutboxLocalChange[];
};

/**
 * Defines a worker-side handler for one kind.
 * The handler is a closure, so the registry stays in the worker.
 */
export type OutboxHandler = (op: OutboxOp) => Promise<OutboxHandlerResult>;

/** Defines the counts of the outbox rows. */
export type OutboxCounts = {
  /** The number of rows that wait for a send. */
  pending: number;
  /** The number of rows with a send in flight. */
  sending: number;
  /** The number of rows that a permanent error stopped. */
  failed: number;
  /** The number of rows that need a human decision. */
  conflict: number;
};

/** Defines the outbox state that the UI reads. */
export type OutboxStatus = OutboxCounts & {
  /** The flag is true when the flusher stopped. */
  paused: boolean;
  /** The flag is true when the session is lost. */
  signInRequired: boolean;
};

/**
 * Defines the input for one new operation.
 * The caller gives the server-corrected time when it has one.
 */
export type OutboxEnqueueInput = {
  /** The handler key. */
  kind: string;
  /** The HTTP method. */
  method: OutboxMethod;
  /** The request path. */
  path: string;
  /** The optional request body. */
  body?: unknown;
  /** The optional server-corrected time in UTC milliseconds. */
  createdAt?: number;
  /** The optional local changes to commit with the record. */
  local?: readonly OutboxLocalChange[];
};

/** Defines the result of one flush. */
export type OutboxFlushResult = OutboxCounts & {
  /** The number of rows that the flush removed. */
  sent: number;
  /** The flag is true when the flusher stopped. */
  paused: boolean;
  /** The flag is true when the session is lost. */
  signInRequired: boolean;
};
