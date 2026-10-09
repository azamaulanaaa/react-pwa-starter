import { defineConfig } from "vitest/config";

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
    alias: {
      "@": SRC_PATH,
    },
  },
});
