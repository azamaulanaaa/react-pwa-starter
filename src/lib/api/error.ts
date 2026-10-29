/**
 * Defines the error that the API client returns.
 * The status is the HTTP status code.
 * The status is null when no response arrived.
 */
export class ApiError extends Error {
  readonly status: number | null;

  /**
   * Builds an API error.
   * The caller gives the message and the status.
   */
  constructor(message: string, status: number | null, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Returns the message from an error envelope.
 * The function reads the `error` field when it is a non-empty string.
 * The function returns a generic message for any other body.
 */
export function errorMessageFromBody(body: unknown, status: number): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string" &&
    body.error.trim() !== ""
  ) {
    return body.error;
  }

  return `The request failed. The server returned status ${status}.`;
}

/**
 * Builds an ApiError from a failed response.
 * The function reads the `{ "error": "..." }` envelope.
 * The function does not throw when the body is empty or is not JSON.
 */
export async function apiErrorFromResponse(
  response: Response,
): Promise<ApiError> {
  let message = `The request failed. The server returned status ${response.status}.`;

  try {
    const body: unknown = await response.json();
    message = errorMessageFromBody(body, response.status);
  } catch {
    // The body is empty or is not JSON. The generic message stays.
  }

  return new ApiError(message, response.status);
}
