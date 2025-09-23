import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy API requests to wrangler dev server
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true
      },
      "/check-open-ai-key": {
        target: "http://localhost:8787",
        changeOrigin: true
      }
    }
  },
  build: {
    // Build to public directory so wrangler can serve it
    outDir: "public",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
