import { ApiError, apiErrorFromResponse } from "@/lib/api/error.ts";
import type {
  ApiClient,
  ApiClientOptions,
  ApiRequestOptions,
  FetchFunction,
} from "@/lib/api/types.ts";

/**
 * Defines the base URL that the client uses when the environment gives none.
 */
export const DEFAULT_API_BASE_URL = "/api";

/**
 * Returns the base URL for the client.
 * The function reads `VITE_API_BASE_URL` when the caller gives no URL.
 * The function returns `/api` when the value is empty.
 */
export function resolveApiBaseUrl(baseUrl?: string): string {
  const env = (
    import.meta as unknown as { env?: Record<string, string | undefined> }
  ).env;
  const candidate = baseUrl ?? env?.VITE_API_BASE_URL ?? "";
  const value = candidate.trim();

  return (value === "" ? DEFAULT_API_BASE_URL : value).replace(/\/+$/, "");
}

/**
 * Joins the base URL and the request path.
 * The function does not use the `URL` type, so a relative base URL stays valid.
 */
function joinUrl(baseUrl: string, path: string): string {
  const suffix = path.replace(/^\/+/, "");

  if (baseUrl === "") return `/${suffix}`;
  return suffix === "" ? baseUrl : `${baseUrl}/${suffix}`;
}

/**
 * Creates a generic HTTP client.
 * The client sends JSON and reads JSON.
 * The client has no domain type.
 */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = resolveApiBaseUrl(options.baseUrl);
  const fetchImpl: FetchFunction = options.fetch ?? globalThis.fetch;
  const tokenProvider = options.tokenProvider;
  const clockSampler = options.clock;

  return {
    async request<T>(
      path: string,
      requestOptions: ApiRequestOptions = {},
    ): Promise<T> {
      const headers = new Headers(requestOptions.headers);
      headers.set("Accept", "application/json");

      let body: BodyInit | undefined;
      if (requestOptions.body !== undefined) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(requestOptions.body);
      }

      const token = await tokenProvider?.getToken();
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      let response: Response;
      const startedAtMs = Date.now();
      try {
        response = await fetchImpl(joinUrl(baseUrl, path), {
          method: requestOptions.method ?? "GET",
          headers,
          body,
          signal: requestOptions.signal,
        });
      } catch (cause) {
        throw new ApiError(
          "The request failed. The network request did not complete.",
          null,
          { cause },
        );
      }

      clockSampler?.sampleFrom(response, startedAtMs);

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
  };
}
