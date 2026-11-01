import type { ClockSampler } from "@/lib/time/types.ts";

/** Defines the HTTP methods that the client sends. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Supplies the token for a request.
 * A React provider can implement this interface.
 * The method can return the token directly or with a promise.
 */
export interface TokenProvider {
  /**
   * Returns the current token.
   * The method returns null when no token exists.
   */
  getToken(): string | null | Promise<string | null>;
}

/** Defines the fetch function that the client calls. */
export type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Defines the options for one request.
 * The client sends the body as JSON.
 */
export interface ApiRequestOptions {
  /** The HTTP method. The default is GET. */
  method?: HttpMethod;
  /** The request body. The client converts it to JSON. */
  body?: unknown;
  /** Extra request headers. */
  headers?: HeadersInit;
  /** The signal that cancels the request. */
  signal?: AbortSignal;
}

/**
 * Defines the options for the client.
 * The caller can replace the base URL, the fetch function, and the token source.
 */
export interface ApiClientOptions {
  /** The base URL. The default is `VITE_API_BASE_URL`, then `/api`. */
  baseUrl?: string;
  /** The fetch function. The default is the global `fetch`. */
  fetch?: FetchFunction;
  /** The token source. The client sends no bearer header when this is absent. */
  tokenProvider?: TokenProvider;
  /**
   * The server clock sampler.
   * The client samples every response when this is present.
   */
  clock?: ClockSampler;
}

/**
 * Defines the generic HTTP client.
 * The client sends JSON and reads JSON.
 * The client has no domain type.
 */
export interface ApiClient {
  /**
   * Sends one request and returns the parsed response.
   * The function returns undefined for an empty response.
   */
  request<T>(path: string, options?: ApiRequestOptions): Promise<T>;
}
