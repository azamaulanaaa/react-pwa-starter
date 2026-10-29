/** Defines the error for a failed session call. */
export class SessionError extends Error {
  /**
   * Builds a session error.
   * The caller gives the message and an optional cause.
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SessionError";
  }
}

/**
 * Converts a cause into a SessionError.
 * The function keeps the provider message when it exists.
 */
export function toSessionError(cause: unknown): SessionError {
  const message =
    cause instanceof Error && cause.message.trim() !== ""
      ? cause.message
      : "The session check failed. The provider returned an error.";

  return new SessionError(message, { cause });
}
