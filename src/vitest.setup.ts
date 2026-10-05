import { vi } from "vitest";

// Node 22+ defines a stubbed `localStorage` global that is `undefined` without
// --localstorage-file, and jsdom's window under this Vitest version does not
// expose a working Storage either (verified: setting environmentOptions.jsdom.url
// does not help). Install a minimal in-memory Storage so DOM tests can exercise
// source that touches `localStorage` directly. Node-environment test files
// (no window) are unaffected.
if (
  typeof window !== "undefined" &&
  typeof window.localStorage === "undefined"
) {
  const createMemoryStorage = (): Storage => {
    const map = new Map<string, string>();

    return {
      get length() {
        return map.size;
      },
      key: (index: number) => [...map.keys()][index] ?? null,
      getItem: (key: string) => map.get(String(key)) ?? null,
      setItem: (key: string, value: string) => {
        map.set(String(key), String(value));
      },
      removeItem: (key: string) => {
        map.delete(String(key));
      },
      clear: () => {
        map.clear();
      },
    };
  };

  vi.stubGlobal("localStorage", createMemoryStorage());
}

// Use cross-runtime way to get the root directory
const __ROOT__ = new URL("../", import.meta.url);

vi.stubGlobal("fetch", async (url: string) => {
  // Normalize the URL to a public file path
  const relativePath = url.startsWith("/") ? url.slice(1) : url;
  const fileUrl = new URL(relativePath, new URL("public/", __ROOT__));

  try {
    let content: string;

    // Runtime-specific reading
    if (typeof (globalThis as { Deno?: unknown }).Deno !== "undefined") {
      content = await Deno.readTextFile(fileUrl.toString());
    } else if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") {
      content = await Bun.file(fileUrl).text();
    } else {
      // Node fallback (using dynamic import to avoid crashes in non-node)
      const { readFileSync } = await import("node:fs");
      content = readFileSync(fileUrl.toString(), "utf-8");
    }

    return new Response(content, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`Failed to load locale: ${url}`, e);
    return { ok: false, status: 404 };
  }
});
