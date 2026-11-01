/**
 * Defines the options that the caller can give to an API error.
 * The options extend `ErrorOptions` with the machine code and the details.
 */
export type ApiErrorOptions = ErrorOptions & {
  /** The stable machine code from the response body. */
  code?: string | null;
  /** The details from the response body. */
  details?: unknown;
};

/**
 * Defines the error that the API client returns.
 * The status is the HTTP status code.
 * The status is null when no response arrived.
 * The code is null when the response body has no code.
 * The details are undefined when the response body has no details.
 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly details: unknown;

  /**
   * Builds an API error.
   * The caller gives the message and the status.
   * The caller can give the code and the details in the options.
   */
  constructor(
    message: string,
    status: number | null,
    options?: ApiErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code ?? null;
    this.details = options?.details;
  }
}

/** Returns true when the value is a non-null object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/**
 * Returns the message from an error envelope.
 * The function reads the `error` field when it is a non-empty string.
 * The function returns a generic message for any other body.
 */
export function errorMessageFromBody(body: unknown, status: number): string {
  if (
    isRecord(body) &&
    "error" in body &&
    typeof body.error === "string" &&
    body.error.trim() !== ""
  ) {
    return body.error;
  }

  return `The request failed. The server returned status ${status}.`;
}

/**
 * Returns the machine code from an error envelope.
 * The function reads the `code` field when it is a non-empty string.
 * The function returns null for any other body.
 */
function errorCodeFromBody(body: unknown): string | null {
  if (
    isRecord(body) &&
    "code" in body &&
    typeof body.code === "string" &&
    body.code.trim() !== ""
  ) {
    return body.code;
  }

  return null;
}

/**
 * Returns the details from an error envelope.
 * The function reads the `details` field when the body has it.
 * The function returns undefined for any other body.
 */
function errorDetailsFromBody(body: unknown): unknown {
  if (!isRecord(body) || !("details" in body)) return undefined;

  return body.details;
}

/**
 * Builds an ApiError from a failed response.
 * The function reads the `{ "error": "...", "code": "...", "details": ... }`
 * envelope.
 * The function does not throw when the body is empty or is not JSON.
 */
export async function apiErrorFromResponse(
  response: Response,
): Promise<ApiError> {
  let message = `The request failed. The server returned status ${response.status}.`;
  let code: string | null = null;
  let details: unknown;

  try {
    const body: unknown = await response.json();
    message = errorMessageFromBody(body, response.status);
    code = errorCodeFromBody(body);
    details = errorDetailsFromBody(body);
  } catch {
    // The body is empty or is not JSON. The generic message stays.
  }

  return new ApiError(message, response.status, { code, details });
}
