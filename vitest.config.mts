import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
    // `server-only` resolves to an empty module under the react-server condition.
    conditions: ["react-server"],
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    // every file gets its own process and its own temporary database (see tests/helpers.ts)
    isolate: true,
    setupFiles: ["tests/setup.ts"],
    env: { TIARA_ENV: "test", NODE_ENV: "test" },
  },
});
