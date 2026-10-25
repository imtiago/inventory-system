import { defineConfig } from "tsup";

// Bundla só o código do projeto (aliases do tsconfig resolvidos);
// dependências de node_modules ficam externas.
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
});
