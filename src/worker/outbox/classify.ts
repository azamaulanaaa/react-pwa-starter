import type {
  OutboxErrorInfo,
  OutboxHandlerResult,
  OutboxLocalChange,
} from "@/lib/outbox/types.ts";

/** Defines the normalized result of one handler call. */
export type OutboxOutcome = {
  /** The HTTP status. The value is null for a network error. */
  status: number | null;
  /** The optional error code from the response envelope. */
  code?: string;
  /** The optional message. */
  message?: string;
  /** The local row changes from a successful call. */
  local?: readonly OutboxLocalChange[];
};

/** Defines the action for one handler call. */
export type OutboxClassification =
  | { kind: "success"; local: readonly OutboxLocalChange[] }
  | { kind: "unauthorized"; error: OutboxErrorInfo }
  | { kind: "permanent"; state: "failed" | "conflict"; error: OutboxErrorInfo }
  | { kind: "transient"; error: OutboxErrorInfo };

// These codes need a human decision. The row goes to the review state.
const CONFLICT_CODES = new Set(["conflict", "duplicate"]);

// These codes cannot succeed on a retry. The row goes to the failed state.
const PERMANENT_CODES = new Set([
  "forbidden",
  "not_found",
  "resync_required",
  "invalid_input",
  "invalid_request",
  "unprocessable_entity",
]);

/**
 * Reads the status and the optional code from a thrown error.
 * The function reads `status` and `code` when the error has them.
 * The function treats every other error as a network error.
 */
export function outcomeFromError(error: unknown): OutboxOutcome {
  const record =
    error !== null && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const status = typeof record.status === "number" ? record.status : null;
  const code = typeof record.code === "string" ? record.code : undefined;
  const message =
    error instanceof Error && error.message.trim() !== ""
      ? error.message
      : String(error);

  return { status, code, message };
}

/** Converts the handler result to the normalized outcome. */
export function outcomeFromResult(result: OutboxHandlerResult): OutboxOutcome {
  return {
    status: result.status,
    code: result.code,
    message: result.message,
    local: result.local,
  };
}

function messageOf(outcome: OutboxOutcome): string {
  if (outcome.message !== undefined && outcome.message.trim() !== "") {
    return outcome.message;
  }
  if (outcome.status === null) return "The network request failed.";
  return `The server returned status ${outcome.status}.`;
}

function errorOf(
  outcome: OutboxOutcome,
  fallbackCode: string,
): OutboxErrorInfo {
  return {
    code: outcome.code ?? fallbackCode,
    message: messageOf(outcome),
  };
}

/**
 * Classifies one handler call.
 * A `2xx` response succeeds.
 * A `401` response stops the flusher.
 * A `409` response, or a conflict code, needs a human decision.
 * A permanent `4xx` code moves the row to the failed state.
 * Every other response is transient.
 */
export function classifyOutcome(outcome: OutboxOutcome): OutboxClassification {
  const status = outcome.status;
  const code = outcome.code;

  if (status !== null && status >= 200 && status < 300) {
    return { kind: "success", local: outcome.local ?? [] };
  }

  if (status === 401) {
    return { kind: "unauthorized", error: errorOf(outcome, "unauthorized") };
  }

  if (status === 409 || (code !== undefined && CONFLICT_CODES.has(code))) {
    return {
      kind: "permanent",
      state: "conflict",
      error: errorOf(outcome, "conflict"),
    };
  }

  if (
    status !== null &&
    status >= 400 &&
    status < 500 &&
    code !== undefined &&
    PERMANENT_CODES.has(code)
  ) {
    return {
      kind: "permanent",
      state: "failed",
      error: errorOf(outcome, "permanent_error"),
    };
  }

  const fallback =
    status === null
      ? "network"
      : status === 429
        ? "rate_limited"
        : status >= 500
          ? "server_error"
          : "http_error";

  return { kind: "transient", error: errorOf(outcome, fallback) };
}
