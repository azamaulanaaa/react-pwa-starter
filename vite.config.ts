import { defineConfig } from "vite";
import { dirname, fromFileUrl, resolve } from "@std/path";
import deno from "@deno/vite-plugin";
import react from "@vitejs/plugin-react-swc";

const __dirname = dirname(fromFileUrl(import.meta.url));

export default defineConfig({
  plugins: [deno(), react()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
