import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks (cached across deploys). html5-qrcode is left out on purpose: it is only
        // imported dynamically by the scanner and must not be pulled into a chunk loaded at startup.
        manualChunks(id: string) {
          if (!id.includes("node_modules") || id.includes("html5-qrcode")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return "vendor-react";
          if (/node_modules\/(@tanstack|axios|zustand)\//.test(id)) return "vendor-data";
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    testTimeout: 20000,
    env: { TZ: "America/Sao_Paulo", VITE_API_URL: "http://localhost:3000" },
  },
});
