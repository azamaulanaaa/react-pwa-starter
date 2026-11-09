/** Lists the URL protocols that the editor never accepts. */
const FORBIDDEN_PROTOCOLS = new Set([
  "data:",
  "file:",
  "javascript:",
  "blob:",
  "vbscript:",
]);

/** Matches a URL that starts with a scheme. */
const ABSOLUTE_SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:/;

/**
 * Returns true when the editor can apply one URL to a link.
 * The function accepts https:, mailto:, and same-origin relative paths.
 */
export function validateUrl(url: string): boolean {
  const candidate = url.trim();

  if (candidate === "" || candidate.startsWith("//")) {
    return false;
  }

  try {
    const parsed = new URL(candidate, window.location.origin);

    if (FORBIDDEN_PROTOCOLS.has(parsed.protocol)) {
      return false;
    }

    if (parsed.protocol === "https:" || parsed.protocol === "mailto:") {
      return true;
    }

    if (ABSOLUTE_SCHEME.test(candidate)) {
      return false;
    }

    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}
