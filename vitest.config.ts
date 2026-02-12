import { defineConfig } from "vitest/config";

const SRC_PATH = new URL("./src", import.meta.url).pathname;

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/vitest.setup.ts"],
    alias: {
      "@": SRC_PATH,
    },
  },
});
