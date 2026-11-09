/** Defines the two kinds of mention target. */
export type MentionKind = "user" | "page";

/** Describes one mention target. */
export interface MentionTarget {
  /** The target kind. */
  kind: MentionKind;
  /** The target identifier. */
  id: string;
  /** The label that the mention shows. */
  label: string;
  /** The optional text that gives more detail about the target. */
  description?: string;
}

/**
 * Defines a source of mention targets.
 * The source searches for targets and returns one target by kind and id.
 */
export interface MentionSource {
  /**
   * Returns the targets that match the query.
   * The method matches the query against the label and the description.
   * The method stops when the signal aborts.
   */
  search(query: string, signal?: AbortSignal): Promise<MentionTarget[]>;

  /** Returns one target. The method returns null when the target is absent. */
  get(target: { kind: MentionKind; id: string }): Promise<MentionTarget | null>;
}
