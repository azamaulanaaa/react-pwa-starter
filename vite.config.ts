import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { comlink } from "vite-plugin-comlink";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";
import type { OutputOptions } from "rollup";

const PWA_MANIFEST: VitePWAOptions["manifest"] = {
  name: "React PWA",
  short_name: "RPWA",
  description: "A high-performance PWA running everywhere",
  theme_color: "#4f46e5",
  background_color: "#ffffff",
  display: "standalone",
  icons: [
    {
      src: "icons/pwa-64x64.png",
      sizes: "64x64",
      type: "image/png",
    },
    {
      src: "icons/pwa-192x192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "icons/pwa-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "icons/maskable-icon-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

const VENDOR_GROUPS: Record<string, string[]> = {
  // Core UI & Framework
  react: ["react", "react-dom", "scheduler"],
  // Router
  router: [
    "@tanstack/router-core",
    "@tanstack/react-router",
    "@tanstack/react-store",
    "@tanstack/history",
    "isbot",
    "tiny-invariant",
    "tiny-warning",
  ],
  // Data Persistence (Large footprint, keep isolated)
  rxdb: ["rxdb", "rxjs"],
  dexie: ["dexie"],
  // Animation & Icons (Heavy assets)
  visuals: ["@base-ui", "motion", "lucide-react"],
  // State & Logic
  tanstack: ["@tanstack"],
  // Internationalization
  i18n: ["i18next", "i18next-browser-languagedetector", "i18next-http-backend"],
  // Utils (Small, frequently used)
  utils: ["zod", "zustand", "clsx", "tailwind-merge", "uuid"],
};

/**
 * Custom chunk splitting strategy to group dependencies
 * and prevent waterfall loading.
 */
const renderChunks = (id: string): string | undefined => {
  if (id.includes("node_modules")) {
    for (const [name, libs] of Object.entries(VENDOR_GROUPS)) {
      if (libs.some((lib) => id.includes(`node_modules/${lib}/`))) {
        return `vendor-${name}`;
      }
    }
    // Fallback for all other node_modules
    return "vendor-others";
  }
  return undefined;
};

/**
 * Shared Rollup output options to ensure consistency
 * between Main Build and Workers.
 */
const sharedOutputOptions: OutputOptions = {
  manualChunks: renderChunks,
  chunkFileNames: "assets/js/[name]-[hash].js",
  entryFileNames: "assets/js/[name]-[hash].js",
  assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
};

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    comlink(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "icons/apple-touch-icon-180x180.png",
        "icon.svg",
      ],
      manifest: PWA_MANIFEST,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
  worker: {
    format: "es",
    plugins: () => [
      tsconfigPaths(),
      comlink(),
    ],
    rollupOptions: {
      output: sharedOutputOptions,
    },
  },
  build: {
    rollupOptions: {
      output: sharedOutputOptions,
    },
  },
});
