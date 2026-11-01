import { Schema } from "effect";

/**
 * Defines one change row from the server feed.
 * The table is a registered worker table name.
 * The key is the row id in that table.
 */
export type ChangeRow = {
  /** The registered table name. */
  table: string;
  /** The row id. */
  key: string;
  /** The server sequence for this row. */
  seq: number;
  /** The flag is true when the row is a tombstone. */
  deleted: boolean;
  /** The full row document. The value is null for a tombstone. */
  value: unknown | null;
};

/**
 * Defines one page from the server feed.
 * The `next` value is the exclusive cursor for the next call.
 */
export type ChangePage = {
  /** The rows in server sequence order. */
  rows: ChangeRow[];
  /** The exclusive cursor for the next call. */
  next: number;
  /** The flag is true when more pages are available. */
  hasMore: boolean;
  /** The retention floor. A cursor below this value needs a snapshot. */
  oldestSeq: number;
  /** The server time in Unix milliseconds. */
  serverTimeMs: number;
};

/**
 * Defines a pull request for one scope.
 * The scope names one server feed, for example `scope:{id}`.
 */
export type ChangePullInput = {
  /** The server feed scope. */
  scope: string;
  /** The exclusive cursor. The server returns rows after this value. */
  since: number;
  /** The maximum row count. The server decides its own cap. */
  limit?: number;
};

/**
 * Defines the backend-neutral change feed.
 * An adapter implements this interface for one backend.
 * The interface does not name a backend path or a wire shape.
 */
export interface ChangeFeed {
  /** Pulls one page for one scope. */
  pull(input: ChangePullInput): Promise<ChangePage>;
}

/**
 * Defines the change feed failure reasons.
 * `resync_required` means the cursor is below the retention floor.
 */
export type ChangeFeedErrorReason = "resync_required";

/**
 * Defines a typed change feed failure.
 * The transport throws this error when the server returns status 410.
 */
export class ChangeFeedError extends Schema.TaggedError<ChangeFeedError>()(
  "ChangeFeedError",
  {
    reason: Schema.Literals(["resync_required"]),
  },
) {}
