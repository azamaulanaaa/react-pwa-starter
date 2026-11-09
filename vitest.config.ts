import { defineConfig } from "vitest/config";

const ROOT_PATH = new URL("./", import.meta.url).pathname;
const SRC_PATH = new URL("./src", import.meta.url).pathname;

export default defineConfig({
  // The tests run the production run path, so the devtools layer stays out.
  define: {
    __DEVTOOLS__: false,
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", ".tmp/**"],
    alias: {
      "@": SRC_PATH,
      "~": ROOT_PATH,
    },
  },
});
