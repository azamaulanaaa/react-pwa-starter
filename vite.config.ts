import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { comlink } from "vite-plugin-comlink";
import { VitePWA } from "vite-plugin-pwa";

const SRC_PATH = new URL("./src", import.meta.url).pathname;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    comlink(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
  worker: {
    plugins: () => [comlink()],
  },
  resolve: {
    alias: { "@": SRC_PATH },
  },
});
