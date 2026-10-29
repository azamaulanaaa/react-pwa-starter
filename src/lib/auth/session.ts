import type { Session } from "@/lib/auth/types.ts";

/**
 * Reports whether a session has expired.
 * The function uses the current time when the caller gives none.
 */
export function isSessionExpired(
  session: Session,
  now: number = Date.now(),
): boolean {
  return session.expiresAt <= now;
}

/**
 * Returns the session when it is active.
 * The function returns null for a missing or expired session.
 */
export function activeSession(
  session: Session | null,
  now: number = Date.now(),
): Session | null {
  if (session === null || isSessionExpired(session, now)) return null;

  return session;
}
