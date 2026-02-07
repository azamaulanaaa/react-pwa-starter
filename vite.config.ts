import { defineConfig } from "vite";
import { dirname, fromFileUrl, resolve } from "@std/path";
import deno from "@deno/vite-plugin";

const __dirname = dirname(fromFileUrl(import.meta.url));

export default defineConfig({
  plugins: [deno()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
