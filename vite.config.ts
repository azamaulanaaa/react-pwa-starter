import { BuildEnvironmentOptions, defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { comlink } from "vite-plugin-comlink";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

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

/**
 * Manual chunking strategies for vendor dependencies.
 * Grouping is optimized for SPA initial boot performance:
 * - Core React and Router run first for immediate navigation.
 * - Heavy data/UI libraries (Effect, TanStack Form/Table) load on demand.
 * - Non-JS assets (like Fontsource CSS) bundle directly into CSS assets.
 */
const VENDOR_GROUPS: Record<string, string[]> = {
  // Core UI runtime required on initial application boot
  react: ["react", "react-dom", "scheduler"],
  // Client-side router & navigation primitives (loaded before page views)
  router: [
    "@tanstack/router-core",
    "@tanstack/react-router",
    "@tanstack/react-router-devtools",
    "@tanstack/react-store",
    "@tanstack/history",
    "isbot",
    "tiny-invariant",
    "tiny-warning",
  ],
  // Data management & form/table logic (separated from router to defer loading)
  "tanstack-ui": [
    "@tanstack/react-form",
    "@tanstack/react-table",
    "@tanstack/form-core",
    "@tanstack/table-core",
  ],
  // UI design system components, icons, and class utility helpers
  visuals: [
    "@base-ui",
    "lucide-react",
    "class-variance-authority",
    "cnfast",
    "react-day-picker",
    "tw-animate-css",
  ],
  // Functional effect system (heavy runtime split into its own chunk)
  effect: ["effect"],
  // Internationalization framework & translation backends
  i18n: ["i18next", "i18next-http-backend"],
  // Client-side IndexedDB storage engine
  database: ["dexie"],
  // Web Worker RPC bridge
  worker: ["comlink", "vite-plugin-comlink"],
  // Service Worker & PWA lifecycle helpers
  pwa: ["workbox-window"],
};

const rolldownGroups = [
  ...Object.entries(VENDOR_GROUPS).map(([name, libs]) => ({
    name: `vendor-${name}`,
    // Matches node_modules/<lib>/ cross-platform across Windows (\) and POSIX (/)
    test: new RegExp(`node_modules[\\\\/](?:${libs.join("|")})[\\\\/]`),
  })),
  // Fallback chunk for any unmapped third-party dependencies
  {
    name: "vendor-others",
    test: /node_modules[\\/]/,
  },
];

const sharedOutputOptions: NonNullable<
  BuildEnvironmentOptions["rolldownOptions"]
>["output"] = {
  chunkFileNames: "assets/js/[name]-[hash].js",
  entryFileNames: "assets/js/[name]-[hash].js",
  assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
  codeSplitting: {
    groups: rolldownGroups,
  },
};

export default defineConfig({
  plugins: [
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
    visualizer(),
  ],
  worker: {
    format: "es",
    plugins: () => [
      comlink(),
    ],
  },
  build: {
    rolldownOptions: {
      output: sharedOutputOptions,
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
