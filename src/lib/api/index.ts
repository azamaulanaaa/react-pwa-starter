export {
  createApiClient,
  DEFAULT_API_BASE_URL,
  resolveApiBaseUrl,
} from "@/lib/api/client.ts";
export {
  ApiError,
  apiErrorFromResponse,
  errorMessageFromBody,
} from "@/lib/api/error.ts";
export type {
  ApiClient,
  ApiClientOptions,
  ApiRequestOptions,
  FetchFunction,
  HttpMethod,
  TokenProvider,
} from "@/lib/api/types.ts";
