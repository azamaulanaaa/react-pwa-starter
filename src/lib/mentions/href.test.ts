import { describe, expect, it } from "vitest";

import { mentionHref, parseMentionHref } from "@/lib/mentions/href.ts";
import type { MentionKind } from "@/lib/mentions/types.ts";

interface RoundTripCase {
  name: string;
  kind: MentionKind;
  id: string;
  href: string;
}

const ROUND_TRIP_CASES: RoundTripCase[] = [
  {
    name: "a user with a numeric id",
    kind: "user",
    id: "123",
    href: "/users/123",
  },
  {
    name: "a user with a dash and an underscore",
    kind: "user",
    id: "alex_morgan-2",
    href: "/users/alex_morgan-2",
  },
  {
    name: "a page with a slug id",
    kind: "page",
    id: "q3-plan",
    href: "/pages/q3-plan",
  },
  {
    name: "a page with an uppercase id",
    kind: "page",
    id: "Q3_Plan",
    href: "/pages/Q3_Plan",
  },
];

const INVALID_HREFS: Array<[string, string]> = [
  ["a protocol-relative value", "//evil/users/1"],
  ["an empty user id", "/users/"],
  ["an empty page id", "/pages/"],
  ["a missing user id", "/users"],
  ["a query string", "/users/1?x"],
  ["a fragment", "/users/1#x"],
  ["a query string on a page", "/pages/1?x"],
  ["a fragment on a page", "/pages/1#x"],
  ["another path", "/teams/1"],
  ["a scheme", "javascript:alert(1)"],
  ["an absolute URL", "http://local/users/1"],
  ["an encoded id", "/users/%31"],
  ["an extra path segment", "/users/1/extra"],
];

describe("mention href", () => {
  it.each(ROUND_TRIP_CASES)("round-trips $name", ({ kind, id, href }) => {
    expect(mentionHref({ kind, id })).toBe(href);
    expect(parseMentionHref(href)).toEqual({ kind, id });
  });

  it.each(INVALID_HREFS)("rejects %s", (_name, href) => {
    expect(parseMentionHref(href)).toBeNull();
  });
});
