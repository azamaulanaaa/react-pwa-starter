import type { Session } from "@/lib/auth/types.ts";

/** The time before the session expiry when the provider refreshes the session. */
export const REFRESH_LEAD_MS = 60_000;

/**
 * Returns the delay before the refresh timer fires.
 * The function returns zero when the refresh time has passed.
 */
export function refreshDelayMs(
  session: Session,
  now: number = Date.now(),
): number {
  return Math.max(0, session.expiresAt - now - REFRESH_LEAD_MS);
}

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
