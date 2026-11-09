import type { MentionSource, MentionTarget } from "./types.ts";

/** Defines the maximum number of results that one search returns. */
export const LOCAL_MENTION_SEARCH_LIMIT = 20;

/** Defines the targets that the local source uses by default. */
export const LOCAL_MENTION_TARGETS: MentionTarget[] = [
  {
    kind: "user",
    id: "alex-morgan",
    label: "Alex Morgan",
    description: "Product manager",
  },
  {
    kind: "user",
    id: "jordan-lee",
    label: "Jordan Lee",
    description: "Engineering lead",
  },
  {
    kind: "user",
    id: "sam-rivera",
    label: "Sam Rivera",
    description: "Content designer",
  },
  {
    kind: "page",
    id: "product-roadmap",
    label: "Product Roadmap",
    description: "Plans for the next two quarters",
  },
  {
    kind: "page",
    id: "team-onboarding",
    label: "Team Onboarding",
    description: "First-week checklist for new team members",
  },
  {
    kind: "page",
    id: "design-system",
    label: "Design System",
    description: "Shared components and guidelines",
  },
];

/** Compares two targets. The function puts users before pages, then sorts by label. */
function compareTargets(left: MentionTarget, right: MentionTarget): number {
  if (left.kind !== right.kind) return left.kind === "user" ? -1 : 1;

  const byLabel = left.label.localeCompare(right.label, "en-US");

  if (byLabel !== 0) return byLabel;

  return left.id.localeCompare(right.id, "en-US");
}

/** Returns true when the target matches the query. */
function matchesQuery(target: MentionTarget, query: string): boolean {
  if (query === "") return true;

  if (target.label.toLowerCase().includes(query)) return true;

  return target.description?.toLowerCase().includes(query) ?? false;
}

/**
 * Builds a mention source from a fixed target list.
 * The search matches the label and the description without case.
 * The search puts users before pages, then sorts by label, and returns at most
 * 20 results.
 * The search rejects with an AbortError when the signal aborts.
 */
export function createLocalMentionSource(
  targets: MentionTarget[],
): MentionSource {
  return {
    async search(query, signal) {
      if (signal?.aborted) {
        throw new DOMException("The mention search stopped.", "AbortError");
      }

      const normalized = query.trim().toLowerCase();
      const results = targets.filter((target) =>
        matchesQuery(target, normalized),
      );

      results.sort(compareTargets);

      return results.slice(0, LOCAL_MENTION_SEARCH_LIMIT);
    },

    async get(target) {
      return (
        targets.find(
          (item) => item.kind === target.kind && item.id === target.id,
        ) ?? null
      );
    },
  };
}
