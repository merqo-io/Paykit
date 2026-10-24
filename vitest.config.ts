import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  envDir: false,
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "server-only": path.resolve(rootDir, "test/server-only.ts"),
    },
  },
  test: {
    maxWorkers: 2,
    globals: true,
    environment: "node",
    // Bumped from 10s: under heavy concurrent load a real test occasionally
    // exceeds it (Test timed out in 10000ms) with no logic change on its
    // part, and a test that times out skips its own afterEach cleanup,
    // leaking a stale render into whatever runs next in the same file.
    testTimeout: 30000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-anon-key",
    },
    passWithNoTests: true,
    setupFiles: ["./test/setup.ts"],
    include: [
      "test/**/*.{test,spec}.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
      "eslint.config.test.ts",
    ],
    coverage: {
      provider: "v8",
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      reporter: ["text", "lcov", "cobertura"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
    },
  },
});
