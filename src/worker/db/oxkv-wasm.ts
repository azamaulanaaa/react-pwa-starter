import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import initOxkv from "oxkv";

const require = createRequire(import.meta.url);

export async function setupOxkv(): Promise<void> {
  const wasmPath = require.resolve("oxkv/oxkv_bg.wasm");

  await initOxkv(readFileSync(wasmPath) satisfies BufferSource);
}
