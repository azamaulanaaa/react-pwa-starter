import { defineConfig } from "vite";
import { dirname, fromFileUrl, resolve } from "@std/path";
import deno from "@deno/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { comlink } from "vite-plugin-comlink";

const __dirname = dirname(fromFileUrl(import.meta.url));

export default defineConfig({
  plugins: [deno(), react(), tailwindcss(), comlink()],
  worker: {
    plugins: () => [comlink()],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
