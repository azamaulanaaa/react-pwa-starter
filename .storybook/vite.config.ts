import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "../package.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * The Storybook Vite config stays small on purpose. The root config holds
 * app-only plugins (router, PWA, Comlink, visualizer) that do not belong in
 * the preview build.
 */
export default defineConfig({
  define: {
    __APP_NAME__: JSON.stringify(pkg.name),
    __DEVTOOLS__: JSON.stringify(false),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "~": resolve(__dirname, ".."),
      "@": resolve(__dirname, "../src"),
    },
  },
});
