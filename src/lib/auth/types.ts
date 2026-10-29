/** Defines the identity of one user in a session. */
export interface SessionUser {
  /** The stable identifier for the user. */
  id: string;
  /** The display name for the user. */
  name?: string;
  /** The email address for the user. */
  email?: string;
}

/**
 * Defines one authenticated user session.
 * The expiry time uses Unix epoch milliseconds.
 */
export interface Session {
  /** The user identity. */
  user: SessionUser;
  /** The time when the session expires. The value uses Unix epoch milliseconds. */
  expiresAt: number;
}

/** Defines the state of the session context. */
export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

/** Defines the options for a login call. */
export interface LoginOptions {
  /** The path to open after login. */
  returnTo?: string;
}

/**
 * Defines the backend-neutral session contract.
 * The core does not name an identity provider.
 * An adapter implements this interface for one backend.
 */
export interface SessionProvider {
  /**
   * Returns the current session.
   * The method returns null when no session exists.
   */
  getSession(): Promise<Session | null>;
  /**
   * Starts the login flow.
   * The flow can open a redirect.
   */
  login(options?: LoginOptions): Promise<void>;
  /**
   * Ends the current session.
   * The method does not throw when no session exists.
   */
  logout(): Promise<void>;
  /**
   * Renews the current session.
   * The method returns null when no session exists.
   */
  refresh(): Promise<Session | null>;
}
