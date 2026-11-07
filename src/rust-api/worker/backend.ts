import type { FetchFunction } from "@/lib/api/types.ts";
import type { FileTransport } from "@/lib/fs/index.ts";
import type { ReplicaReader } from "@/lib/sync/index.ts";

import {
  createRustApiClient,
  resolveRustApiBaseUrl,
} from "../shared/client.ts";
import type { RustApiClient, RustApiTokenStore } from "../shared/client.ts";
import { isRustApiEnabled, readRustApiEnv } from "../shared/config.ts";
import type { RustApiEnv } from "../shared/config.ts";
import { createRustApiFileTransport } from "../shared/fs.ts";
import { createRustApiReplicaReader } from "../shared/sync.ts";

/** Defines the options for the worker rust-api backend. */
export interface RustApiWorkerBackendOptions {
  /** The environment values. The default is `import.meta.env`. */
  env?: RustApiEnv;
  /** The base URL. The default is `VITE_RUST_API_BASE_URL`, then the local default. */
  baseUrl?: string;
  /** The fetch function. The default is the global `fetch`. */
  fetch?: FetchFunction;
  /** The token store. The default is a new in-memory store. */
  tokens?: RustApiTokenStore;
}

/**
 * Defines the worker rust-api backend.
 * The replica and file adapters share one client and one token store.
 */
export interface RustApiWorkerBackend {
  /** The shared rust-api client. */
  client: RustApiClient;
  /** The replica reader. */
  replica: ReplicaReader;
  /** The file transport. */
  files: FileTransport;
}

/**
 * Creates the worker rust-api backend.
 * The function creates one client. The replica and file adapters use it.
 */
export function createRustApiWorkerBackend(
  options: RustApiWorkerBackendOptions = {},
): RustApiWorkerBackend {
  const env = options.env ?? readRustApiEnv();
  const baseUrl = resolveRustApiBaseUrl(options.baseUrl, env);
  const client = createRustApiClient({
    baseUrl,
    fetch: options.fetch,
    tokens: options.tokens,
  });

  return {
    client,
    replica: createRustApiReplicaReader({ client }),
    files: createRustApiFileTransport({ client }),
  };
}

/**
 * Creates the worker rust-api backend only when the switch is on.
 * The function returns null when the switch is off.
 * The function sends no request.
 */
export function createRustApiWorkerBackendIfEnabled(
  options: RustApiWorkerBackendOptions = {},
): RustApiWorkerBackend | null {
  return isRustApiEnabled(options.env)
    ? createRustApiWorkerBackend(options)
    : null;
}
