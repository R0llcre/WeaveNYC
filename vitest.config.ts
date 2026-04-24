import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@weavenyc/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@weavenyc/shared/contracts": path.resolve(
        __dirname,
        "packages/shared/src/contracts.ts",
      ),
      "@weavenyc/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@weavenyc/test-utils": path.resolve(
        __dirname,
        "packages/test-utils/src/index.ts",
      ),
      "@": path.resolve(__dirname, "apps/pwa/src"),
      "@testing-library/jest-dom/vitest": path.resolve(
        __dirname,
        "apps/pwa/node_modules/@testing-library/jest-dom/vitest.js",
      ),
      "@testing-library/jest-dom": path.resolve(
        __dirname,
        "apps/pwa/node_modules/@testing-library/jest-dom",
      ),
      "@testing-library/react": path.resolve(
        __dirname,
        "apps/pwa/node_modules/@testing-library/react",
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "services/**/*.test.ts",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
      "tests/docs/**/*.test.ts",
    ],
    // apps/mobile uses jest (not vitest) — mobile tests import via the
    // `@/*` path alias which this root vitest resolver maps to
    // apps/pwa/src, not apps/mobile/src, so co-collecting them here
    // surfaces as "Cannot find module '@/theme'" in CI. Mobile runs its
    // own `pnpm --filter @weavenyc/mobile test` step (already green in
    // Mobile Build workflow), so excluding them from root vitest is the
    // correct split — not a regression in coverage.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "apps/mobile/**",
    ],
    environmentMatchGlobs: [
      ["apps/pwa/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      enabled: false,
    },
  },
});
