import { describe, expect, it } from "vitest";

import {
  createLocalMentionSource,
  LOCAL_MENTION_SEARCH_LIMIT,
  LOCAL_MENTION_TARGETS,
} from "@/lib/mentions/local-source.ts";
import type { MentionKind, MentionTarget } from "@/lib/mentions/types.ts";

const TARGETS: MentionTarget[] = [
  {
    kind: "page",
    id: "page-alpha",
    label: "Alpha Plan",
    description: "Quarterly goals",
  },
  {
    kind: "user",
    id: "user-zoe",
    label: "Zoe Adams",
    description: "Design lead",
  },
  {
    kind: "user",
    id: "user-amy",
    label: "Amy Bell",
    description: "Writes the release notes",
  },
  {
    kind: "page",
    id: "page-beta",
    label: "Beta Notes",
    description: "Meeting record",
  },
];

const SOURCE = createLocalMentionSource(TARGETS);

interface SearchCase {
  name: string;
  query: string;
  expected: string[];
}

const SEARCH_CASES: SearchCase[] = [
  {
    name: "matches a label without case",
    query: "aMy",
    expected: ["user-amy"],
  },
  {
    name: "matches a description without case",
    query: "RELEASE",
    expected: ["user-amy"],
  },
  {
    name: "matches a page label",
    query: "beta",
    expected: ["page-beta"],
  },
  {
    name: "matches a page description",
    query: "quarterly",
    expected: ["page-alpha"],
  },
  {
    name: "ignores space around the query",
    query: "  zoe  ",
    expected: ["user-zoe"],
  },
  {
    name: "returns all targets for an empty query",
    query: "",
    expected: ["user-amy", "user-zoe", "page-alpha", "page-beta"],
  },
  {
    name: "returns an empty list when no target matches",
    query: "zzz",
    expected: [],
  },
];

const GET_CASES: Array<{ name: string; kind: MentionKind; id: string }> = [
  { name: "a user", kind: "user", id: "user-amy" },
  { name: "a page", kind: "page", id: "page-beta" },
];

const MISSING_CASES: Array<{ name: string; kind: MentionKind; id: string }> = [
  { name: "an absent id", kind: "user", id: "missing" },
  { name: "a page id with the user kind", kind: "user", id: "page-beta" },
];

describe("local mention source search", () => {
  it.each(SEARCH_CASES)("$name", async ({ query, expected }) => {
    const results = await SOURCE.search(query);

    expect(results.map((target) => target.id)).toEqual(expected);
  });

  it("puts users before pages and sorts each group by label", async () => {
    const results = await SOURCE.search("");

    expect(results.map((target) => target.id)).toEqual([
      "user-amy",
      "user-zoe",
      "page-alpha",
      "page-beta",
    ]);
  });

  it("caps the result at the search limit", async () => {
    const targets: MentionTarget[] = Array.from({ length: 25 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");

      return {
        kind: "user",
        id: `user-${number}`,
        label: `User ${number}`,
      };
    });
    const source = createLocalMentionSource(targets);
    const results = await source.search("");

    expect(results).toHaveLength(LOCAL_MENTION_SEARCH_LIMIT);
    expect(results[0]?.id).toBe("user-01");
    expect(results[19]?.id).toBe("user-20");
  });

  it("rejects with an AbortError when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = SOURCE.search("a", controller.signal);

    await expect(result).rejects.toBeInstanceOf(DOMException);
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });

  it("returns results when the signal is not aborted", async () => {
    const controller = new AbortController();
    const results = await SOURCE.search("a", controller.signal);

    expect(results.length).toBeGreaterThan(0);
  });
});

describe("local mention source get", () => {
  it.each(GET_CASES)("returns $name target", async ({ kind, id }) => {
    const result = await SOURCE.get({ kind, id });

    expect(result).toMatchObject({ kind, id });
  });

  it.each(MISSING_CASES)("returns null for $name", async ({ kind, id }) => {
    await expect(SOURCE.get({ kind, id })).resolves.toBeNull();
  });
});

describe("local mention source seed", () => {
  it("contains at least two users and two pages", () => {
    const users = LOCAL_MENTION_TARGETS.filter(
      (target) => target.kind === "user",
    );
    const pages = LOCAL_MENTION_TARGETS.filter(
      (target) => target.kind === "page",
    );

    expect(users.length).toBeGreaterThanOrEqual(2);
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });
});
