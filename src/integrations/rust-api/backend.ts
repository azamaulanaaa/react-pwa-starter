import type { FetchFunction } from "@/lib/api/types.ts";
import type { FileTransport } from "@/lib/fs/index.ts";
import type { SessionProvider } from "@/lib/auth/index.ts";
import type { ReplicaReader } from "@/lib/sync/index.ts";

import {
  createRustApiSessionProvider,
  type RustApiSessionOptions,
} from "@/integrations/rust-api/auth.ts";
import {
  createRustApiClient,
  resolveRustApiBaseUrl,
  type RustApiClient,
  type RustApiTokenStore,
} from "@/integrations/rust-api/client.ts";
import { createRustApiFileTransport } from "@/integrations/rust-api/fs.ts";
import { createRustApiReplicaReader } from "@/integrations/rust-api/sync.ts";

/** Defines the environment values for the rust-api adapter. */
export type RustApiEnv = Record<string, string | undefined>;

/** Defines the options for the rust-api backend. */
export interface RustApiBackendOptions {
  /** The environment values. The default is `import.meta.env`. */
  env?: RustApiEnv;
  /** The base URL. The default is `VITE_RUST_API_BASE_URL`, then the local default. */
  baseUrl?: string;
  /** The fetch function. The default is the global `fetch`. */
  fetch?: FetchFunction;
  /** The token store. The default is a new in-memory store. */
  tokens?: RustApiTokenStore;
  /** The session options. The backend sets the shared client. */
  session?: Omit<RustApiSessionOptions, "client">;
}

/**
 * Defines the rust-api backend.
 * The session, replica, and file adapters share one client and one token store.
 */
export interface RustApiBackend {
  /** The shared rust-api client. */
  client: RustApiClient;
  /** The session provider. */
  session: SessionProvider;
  /** The replica reader. */
  replica: ReplicaReader;
  /** The file transport. */
  files: FileTransport;
}

/** Returns the build-time environment values. */
function readRustApiEnv(): RustApiEnv {
  return (import.meta as unknown as { env?: RustApiEnv }).env ?? {};
}

/**
 * Reports whether the rust-api backend is enabled.
 * The switch is off unless `VITE_RUST_API_ENABLED` is one of
 * `1`, `true`, `yes`, or `on`.
 */
export function isRustApiEnabled(env: RustApiEnv = readRustApiEnv()): boolean {
  const value = env.VITE_RUST_API_ENABLED?.trim().toLowerCase();

  return value === "1" || value === "true" || value === "yes" || value === "on";
}

/**
 * Creates the rust-api backend.
 * The function creates one client. The session, replica, and file adapters use it.
 */
export function createRustApiBackend(
  options: RustApiBackendOptions = {},
): RustApiBackend {
  const env = options.env ?? readRustApiEnv();
  const baseUrl = resolveRustApiBaseUrl(options.baseUrl, env);
  const client = createRustApiClient({
    baseUrl,
    fetch: options.fetch,
    tokens: options.tokens,
  });

  return {
    client,
    session: createRustApiSessionProvider({
      ...options.session,
      client,
    }),
    replica: createRustApiReplicaReader({ client }),
    files: createRustApiFileTransport({ client }),
  };
}

/**
 * Creates the rust-api backend only when the switch is on.
 * The function returns null when the switch is off.
 * The function sends no request.
 */
export function createRustApiBackendIfEnabled(
  options: RustApiBackendOptions = {},
): RustApiBackend | null {
  return isRustApiEnabled(options.env) ? createRustApiBackend(options) : null;
}
