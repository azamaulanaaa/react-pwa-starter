import { defineConfig } from "vite";
import deno from "@deno/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

const isDeno = typeof (globalThis as any).Deno !== "undefined";
const SRC_PATH = new URL("../src", import.meta.url).pathname;

export default defineConfig({
  plugins: [
    ...(isDeno ? [deno()] : []),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": SRC_PATH },
  },
});
