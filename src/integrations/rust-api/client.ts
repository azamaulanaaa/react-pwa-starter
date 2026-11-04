import { ApiError, apiErrorFromResponse } from "@/lib/api/error.ts";
import type { FetchFunction, HttpMethod } from "@/lib/api/types.ts";

/** Defines the default rust-api base URL for local development. */
export const DEFAULT_RUST_API_BASE_URL = "http://localhost:8080";

/**
 * Holds the bearer token for the adapter.
 * The browser session cookie is the primary credential.
 * The token is an optional in-memory copy from the login callback.
 */
export interface RustApiTokenStore {
  /** Returns the current token. The method returns null when no token exists. */
  getToken(): string | null;
  /** Stores one token. The method clears the token when the value is null. */
  setToken(token: string | null): void;
}

/**
 * Creates an in-memory token store.
 * The store does not persist the token across page loads.
 */
export function createMemoryTokenStore(
  initial: string | null = null,
): RustApiTokenStore {
  let token = initial;

  return {
    getToken: () => token,
    setToken: (next) => {
      token = next;
    },
  };
}

/** Defines the options for one rust-api request. */
export interface RustApiRequestOptions {
  /** The HTTP method. The default is GET. */
  method?: HttpMethod;
  /** A raw request body. The caller sets the content type. */
  body?: BodyInit | null;
  /** A JSON request body. The client sets the content type and serializes the value. */
  json?: unknown;
  /** Extra request headers. */
  headers?: HeadersInit;
  /** The signal that cancels the request. */
  signal?: AbortSignal;
}

/** Defines the options for the rust-api client. */
export interface RustApiClientOptions {
  /** The base URL. The default is `VITE_RUST_API_BASE_URL`, then the local default. */
  baseUrl?: string;
  /** The fetch function. The default is the global `fetch`. */
  fetch?: FetchFunction;
  /** The token store. The client sends no bearer header when the store has no token. */
  tokens?: RustApiTokenStore;
  /** The credentials mode. The default is `include` for the session cookie. */
  credentials?: RequestCredentials;
}

/**
 * Defines the rust-api HTTP client.
 * The client sends the session cookie on every request.
 * The client does not parse domain data.
 */
export interface RustApiClient {
  /** The base URL without a trailing slash. */
  readonly baseUrl: string;
  /** The token store for the adapter. */
  readonly tokens: RustApiTokenStore;
  /** Sends one JSON request and returns the parsed value. */
  request<T>(path: string, options?: RustApiRequestOptions): Promise<T>;
  /** Sends one request and returns the raw response. The caller checks the status. */
  requestRaw(path: string, options?: RustApiRequestOptions): Promise<Response>;
  /** Joins the base URL and one path. */
  url(path: string): string;
}

/**
 * Returns the rust-api base URL.
 * The function reads `VITE_RUST_API_BASE_URL` when the caller gives no URL.
 * The function uses the `env` values when the caller gives them.
 * The function returns the local default when the value is empty.
 */
export function resolveRustApiBaseUrl(
  baseUrl?: string,
  env: Record<string, string | undefined> = (
    import.meta as unknown as { env?: Record<string, string | undefined> }
  ).env ?? {},
): string {
  const candidate = baseUrl ?? env.VITE_RUST_API_BASE_URL ?? "";
  const value = candidate.trim();

  return (value === "" ? DEFAULT_RUST_API_BASE_URL : value).replace(/\/+$/, "");
}

/** Joins the base URL and one path. A relative base URL stays valid. */
function joinUrl(baseUrl: string, path: string): string {
  const suffix = path.replace(/^\/+/, "");

  if (baseUrl === "") return `/${suffix}`;
  return suffix === "" ? baseUrl : `${baseUrl}/${suffix}`;
}

/**
 * Creates the rust-api HTTP client.
 * The client sends the session cookie and an optional bearer token.
 * The client does not add a content type to a raw body.
 */
export function createRustApiClient(
  options: RustApiClientOptions = {},
): RustApiClient {
  const baseUrl = resolveRustApiBaseUrl(options.baseUrl);
  const fetchImpl: FetchFunction = options.fetch ?? globalThis.fetch;
  const tokens = options.tokens ?? createMemoryTokenStore();
  const credentials = options.credentials ?? "include";

  const requestRaw = async (
    path: string,
    requestOptions: RustApiRequestOptions = {},
  ): Promise<Response> => {
    const headers = new Headers(requestOptions.headers);

    let body: BodyInit | null | undefined = requestOptions.body;
    if (requestOptions.json !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(requestOptions.json);
    }

    const token = tokens.getToken();
    if (token !== null && token !== "" && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    try {
      return await fetchImpl(joinUrl(baseUrl, path), {
        method: requestOptions.method ?? "GET",
        headers,
        body,
        signal: requestOptions.signal,
        credentials,
      });
    } catch (cause) {
      throw new ApiError(
        "The request failed. The network request did not complete.",
        null,
        { cause },
      );
    }
  };

  return {
    baseUrl,
    tokens,
    requestRaw,
    async request<T>(
      path: string,
      requestOptions: RustApiRequestOptions = {},
    ): Promise<T> {
      const headers = new Headers(requestOptions.headers);
      headers.set("Accept", "application/json");

      const response = await requestRaw(path, { ...requestOptions, headers });

      if (!response.ok) {
        throw await apiErrorFromResponse(response);
      }

      const text = await response.text();
      if (text.trim() === "") {
        return undefined as T;
      }

      try {
        return JSON.parse(text) as T;
      } catch (cause) {
        throw new ApiError(
          "The request failed. The response is not valid JSON.",
          response.status,
          { cause },
        );
      }
    },
    url: (path) => joinUrl(baseUrl, path),
  };
}
