import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import basicSsl from "@vitejs/plugin-basic-ssl";

// The page may be HTTPS, so the API is reached through the same origin (no mixed content, no CORS on the phone).
const apiProxy = {
  "/api": {
    target: "http://localhost:3000",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api/, ""),
  },
};

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Self-signed HTTPS only with `npm run dev:https` (DEV_HTTPS=1): browsers expose the camera only in a secure context, so
  // a phone opening https://<pc-ip>:5173 can scan. Plain `npm run dev` stays on http://localhost:5173 for the desktop.
  plugins: [react(), tsconfigPaths(), ...(command === "serve" && process.env.DEV_HTTPS === "1" ? [basicSsl()] : [])],
  server: { proxy: apiProxy },
  // `vite preview` serves the production build, whose API base is `/api` (same origin): proxy it like the dev server does.
  preview: { proxy: apiProxy },
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
    exclude: ["**/node_modules/**", "dist/**", "scripts/**"],
    testTimeout: 20000,
    env: { TZ: "America/Sao_Paulo", VITE_API_URL: "http://localhost:3000" },
  },
}));
