import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // cada arquivo de banco sobe um Postgres (PGlite) em memória; 2 por vez cabe em máquinas de 8 GB
    maxWorkers: 2,
    include: ["tests/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
