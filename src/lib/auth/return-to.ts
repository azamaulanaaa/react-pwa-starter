/** The session storage key for the path after login. */
export const RETURN_TO_KEY = "auth.returnTo";

/** Defines the storage that holds the return path. */
export interface ReturnToStorage {
  /** Returns the value for one key. The method returns null when the key is absent. */
  getItem(key: string): string | null;
  /** Stores one value for one key. */
  setItem(key: string, value: string): void;
  /** Removes one key. */
  removeItem(key: string): void;
}

/** Returns the browser session storage. The function returns null when the storage is not available. */
export function browserSessionStorage(): ReturnToStorage | null {
  try {
    if (typeof globalThis.sessionStorage === "undefined") return null;

    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Returns a safe relative path.
 * The function rejects an empty value, an absolute URL, and a protocol-relative path.
 * The function also rejects a backslash, an encoded backslash, and a control character.
 */
export function safeReturnTo(value: string | undefined): string | null {
  if (value === undefined) return null;

  const path = value.trim();

  if (
    path === "" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /%5c/i.test(path) ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    return null;
  }

  return path;
}

/**
 * Stores the return path in session storage before the login redirect.
 * The function ignores an unsafe value.
 * The function returns the stored path, or null when it stores nothing.
 */
export function rememberReturnTo(
  value: string | undefined,
  storage: ReturnToStorage | null = browserSessionStorage(),
): string | null {
  const path = safeReturnTo(value);

  if (path === null || storage === null) return null;

  try {
    storage.setItem(RETURN_TO_KEY, path);
  } catch {
    return null;
  }

  return path;
}

/**
 * Reads and removes the return path after a successful login.
 * The function returns null when no safe path exists.
 */
export function consumeReturnTo(
  storage: ReturnToStorage | null = browserSessionStorage(),
): string | null {
  if (storage === null) return null;

  try {
    const path = storage.getItem(RETURN_TO_KEY);

    if (path === null) return null;

    storage.removeItem(RETURN_TO_KEY);

    return safeReturnTo(path);
  } catch {
    return null;
  }
}

/** Removes the return path from session storage. */
export function clearReturnTo(
  storage: ReturnToStorage | null = browserSessionStorage(),
): void {
  if (storage === null) return;

  try {
    storage.removeItem(RETURN_TO_KEY);
  } catch {
    // A missing storage does not stop the logout.
  }
}
