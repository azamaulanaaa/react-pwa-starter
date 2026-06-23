import { BuildEnvironmentOptions, defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { comlink } from "vite-plugin-comlink";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";

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
  // Animation & Icons (Heavy assets)
  visuals: ["@base-ui", "motion", "lucide-react"],
  // State & Logic
  tanstack: ["@tanstack"],
  // Internationalization
  i18n: ["i18next", "i18next-browser-languagedetector", "i18next-http-backend"],
  // Utils (Small, frequently used)
  utils: ["zod", "zustand", "clsx", "tailwind-merge", "uuid"],
  // dexie
  dexie: ["dexie"],
};

const rolldownGroups = [
  ...Object.entries(VENDOR_GROUPS).map(([name, libs]) => ({
    name: `vendor-${name}`,
    // Creates a regex like: /node_modules\/(react|react-dom|scheduler)\//
    test: new RegExp(`node_modules\\/(${libs.join("|")})\\/`),
  })),
  // Catch-all for any other node_modules not specified above
  {
    name: "vendor-others",
    test: /node_modules\//,
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
  ],
  worker: {
    format: "es",
    plugins: () => [
      comlink(),
    ],
    rolldownOptions: {
      output: sharedOutputOptions,
    },
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
