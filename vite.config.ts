/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Base URL path. "/" for local/dev and root-hosted deployments; the GitHub
// Pages workflow sets BASE_PATH=/esd-k9-logs/ so assets and the PWA
// manifest resolve under the project subpath.
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "ESD K9 Training Logs",
        short_name: "ESD K9",
        description:
          "Offline-first training log for Electronic Storage Device Detection K9 teams",
        theme_color: "#14532d",
        background_color: "#0d1117",
        display: "standalone",
        orientation: "any",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "index.html"
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 2500
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    globals: true
  }
});
