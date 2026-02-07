import { defineConfig } from "vite";
import { dirname, fromFileUrl, resolve } from "@std/path";
import deno from "@deno/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

const __dirname = dirname(fromFileUrl(import.meta.url));

export default defineConfig({
  plugins: [deno(), react(), tailwindcss()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
