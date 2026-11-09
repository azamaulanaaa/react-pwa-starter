import type { MentionKind } from "./types.ts";

/** Defines the origin that the parser uses for a relative path. */
const BASE_URL = "http://local";

/** Matches a mention path and captures the kind group and the id group. */
const MENTION_PATH = /^\/(users|pages)\/([A-Za-z0-9_-]+)$/;

/** Returns the path for one mention target. */
export function mentionHref(target: { kind: MentionKind; id: string }): string {
  return target.kind === "user" ? `/users/${target.id}` : `/pages/${target.id}`;
}

/**
 * Returns the kind and the id from a mention path.
 * The function accepts only `/users/{id}` and `/pages/{id}`.
 * The function rejects a query string, a fragment, another path, an absolute
 * URL, and a protocol-relative value.
 * The function returns null for an invalid value.
 */
export function parseMentionHref(
  href: string,
): { kind: MentionKind; id: string } | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;

  let url: URL;

  try {
    url = new URL(href, BASE_URL);
  } catch {
    return null;
  }

  if (url.origin !== BASE_URL) return null;
  if (url.search !== "" || url.hash !== "") return null;

  const match = MENTION_PATH.exec(url.pathname);

  if (match === null) return null;

  return {
    kind: match[1] === "users" ? "user" : "page",
    id: match[2],
  };
}
