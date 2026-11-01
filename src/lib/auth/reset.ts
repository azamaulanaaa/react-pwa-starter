import type { OutboxCounts } from "@/lib/outbox/types.ts";

/**
 * Holds the system tables that a logout clears.
 * The outbox is not in this list, so an unsent write stays.
 * Issue 9 adds the domain tables to the caller table list.
 */
export const DEFAULT_RESET_TABLES = ["sync_state", "quarantine"] as const;

/** Defines one step of the reset. */
export type SessionResetStep =
  "outbox" | "tables" | "report" | "runtime" | "session" | "logout";

/** Defines one failed reset step. */
export interface SessionResetFailure {
  /** The step that failed first. */
  step: SessionResetStep;
  /** The cause of the failure. */
  error: unknown;
}

/** Defines the input for one reset call. */
export interface SessionResetInput {
  /** The tables to clear. The default holds the system tables. */
  tables?: readonly string[];
  /** Reads the outbox counts. The reset blocks when a write waits. */
  readOutbox: () => Promise<Pick<OutboxCounts, "pending" | "sending">>;
  /** Removes every row of the given tables. */
  clearTables: (tables: readonly string[]) => Promise<unknown>;
  /** Removes every cached report artifact. */
  clearReportCache: () => Promise<void>;
  /** Removes the service worker runtime caches. */
  clearRuntimeCaches: () => Promise<void>;
  /** Removes the session cache. */
  clearSessionCache: () => void;
  /** Ends the session. */
  logout: () => Promise<void>;
}

/** Defines the result of one reset call. */
export type SessionResetResult =
  | { ok: true }
  | {
      ok: false;
      reason: "outbox_pending";
      pending: number;
      sending: number;
      message: string;
    }
  | {
      ok: false;
      reason: "reset_failed";
      step: SessionResetStep;
      error: unknown;
    };

/** Returns an error value in a form that the UI can show. */
export function toResetError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * Runs the logout reset in the fixed order.
 * The reset checks the outbox first.
 * A pending or sending row stops the reset before a clear step runs.
 * A failed step does not stop the later steps.
 * The reset reports the first failure after every step runs.
 */
export async function resetSession(
  input: SessionResetInput,
): Promise<SessionResetResult> {
  let counts: Pick<OutboxCounts, "pending" | "sending">;

  try {
    counts = await input.readOutbox();
  } catch (error) {
    return { ok: false, reason: "reset_failed", step: "outbox", error };
  }

  if (counts.pending > 0 || counts.sending > 0) {
    return {
      ok: false,
      reason: "outbox_pending",
      pending: counts.pending,
      sending: counts.sending,
      message:
        "The outbox has pending writes. Connect to the network, then try again.",
    };
  }

  const steps: [SessionResetStep, () => Promise<unknown>][] = [
    ["tables", () => input.clearTables(input.tables ?? DEFAULT_RESET_TABLES)],
    ["report", input.clearReportCache],
    ["runtime", input.clearRuntimeCaches],
    ["session", async () => input.clearSessionCache()],
    ["logout", input.logout],
  ];
  let failure: SessionResetFailure | null = null;

  for (const [step, run] of steps) {
    try {
      await run();
    } catch (error) {
      failure ??= { step, error };
    }
  }

  if (failure !== null) {
    return {
      ok: false,
      reason: "reset_failed",
      step: failure.step,
      error: failure.error,
    };
  }

  return { ok: true };
}
