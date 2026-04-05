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
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "services/**/*.test.ts",
      "apps/**/*.test.ts",
    ],
    coverage: {
      enabled: false,
    },
  },
});
