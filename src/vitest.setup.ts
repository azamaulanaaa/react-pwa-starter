import { vi } from "vitest";

// Node 22+ defines a `localStorage` global as a stub. The stub stays `undefined`
// without --localstorage-file. The jsdom window in this Vitest version does not
// have a working Storage either. We checked this. Setting
// environmentOptions.jsdom.url does not help.
// This setup installs a minimal in-memory Storage. DOM tests can then run source
// that uses `localStorage` directly. Node-environment test files have no window,
// so they are not affected.
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

// Get the root directory in a way that works in all runtimes
const __ROOT__ = new URL("../", import.meta.url);

vi.stubGlobal("fetch", async (url: string) => {
  // Change the URL into a public file path
  const relativePath = url.startsWith("/") ? url.slice(1) : url;
  const fileUrl = new URL(relativePath, new URL("public/", __ROOT__));

  try {
    let content: string;

    // Read the file. The code uses a different function for each runtime.
    if (typeof (globalThis as { Deno?: unknown }).Deno !== "undefined") {
      content = await Deno.readTextFile(fileUrl.toString());
    } else if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") {
      content = await Bun.file(fileUrl).text();
    } else {
      // Fallback for Node. The code uses a dynamic import. A static import
      // crashes the other runtimes.
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
