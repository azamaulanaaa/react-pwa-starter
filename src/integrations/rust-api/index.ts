export {
  createMemoryTokenStore,
  createRustApiClient,
  DEFAULT_RUST_API_BASE_URL,
  resolveRustApiBaseUrl,
} from "@/integrations/rust-api/client.ts";
export type {
  RustApiClient,
  RustApiClientOptions,
  RustApiRequestOptions,
  RustApiTokenStore,
} from "@/integrations/rust-api/client.ts";

export {
  createRustApiBackend,
  createRustApiBackendIfEnabled,
  isRustApiEnabled,
} from "@/integrations/rust-api/backend.ts";
export type {
  RustApiBackend,
  RustApiBackendOptions,
  RustApiEnv,
} from "@/integrations/rust-api/backend.ts";

export { createRustApiSessionProvider } from "@/integrations/rust-api/auth.ts";
export type { RustApiSessionOptions } from "@/integrations/rust-api/auth.ts";

export {
  buildCallbackPath,
  readLoginSearch,
  RustApiAuthCard,
} from "@/integrations/rust-api/auth-ui.tsx";
export type {
  LoginSearch,
  RustApiAuthCardProps,
} from "@/integrations/rust-api/auth-ui.tsx";

export {
  createRustApiReplicaReader,
  createRustApiSyncTransport,
} from "@/integrations/rust-api/sync.ts";
export type {
  RustApiSyncOptions,
  RustApiSyncTransport,
} from "@/integrations/rust-api/sync.ts";

export { createRustApiFileTransport } from "@/integrations/rust-api/fs.ts";
export type { RustApiFileOptions } from "@/integrations/rust-api/fs.ts";
