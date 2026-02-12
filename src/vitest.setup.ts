import { vi } from "vitest";

// Use cross-runtime way to get the root directory
const __ROOT__ = new URL("../", import.meta.url);

vi.stubGlobal("fetch", async (url: string) => {
  // Normalize the URL to a public file path
  const relativePath = url.startsWith("/") ? url.slice(1) : url;
  const fileUrl = new URL(relativePath, new URL("public/", __ROOT__));

  try {
    let content: string;

    // Runtime-specific reading
    if (typeof (globalThis as any).Deno !== "undefined") {
      content = await Deno.readTextFile(fileUrl);
    } else if (typeof (globalThis as any).Bun !== "undefined") {
      content = await Bun.file(fileUrl).text();
    } else {
      // Node fallback (using dynamic import to avoid crashes in non-node)
      const { readFileSync } = await import("node:fs");
      content = readFileSync(fileUrl, "utf-8");
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
