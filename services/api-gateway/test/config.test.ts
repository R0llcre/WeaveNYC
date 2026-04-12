import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => path.endsWith("pnpm-workspace.yaml") || path.endsWith(".env.example")),
  readFileSync: vi.fn((path: string) => {
    if (path.endsWith(".env.example")) {
      return [
        "NODE_ENV=development",
        "LOG_LEVEL=debug",
        "API_PORT=4000",
        "PWA_PORT=3000",
        "PWA_BASE_URL=http://localhost:3000",
        "DATABASE_URL=postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
        "REDIS_URL=redis://localhost:6379",
        "JWT_SIGNING_PRIVATE_KEY=./infra/dev/jwt-private.pem",
        "JWT_SIGNING_PUBLIC_KEY=./infra/dev/jwt-public.pem",
        "IDENTITY_HASH_PEPPER=weavenyc-dev-identity-pepper"
      ].join("\n");
    }

    return "";
  })
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async (path: string) => {
    if (path.endsWith("jwt-private.pem")) {
      return "PRIVATE";
    }

    return "PUBLIC";
  })
}));

describe("loadConfig", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("requires an explicit identity pepper in production", async () => {
    const { loadConfig } = await import("../src/config.js");

    await expect(
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
        REDIS_URL: "redis://localhost:6379",
        JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
        JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem"
      })
    ).rejects.toThrow("IDENTITY_HASH_PEPPER");
  });

  it("rejects the checked-in sample pepper in production", async () => {
    const { loadConfig } = await import("../src/config.js");

    await expect(
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
        REDIS_URL: "redis://localhost:6379",
        JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
        JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
        IDENTITY_HASH_PEPPER: "weavenyc-dev-identity-pepper"
      })
    ).rejects.toThrow("checked-in development/test sample");
  });

  it("allows test bootstrap to use the checked-in sample pepper", async () => {
    const { loadConfig } = await import("../src/config.js");

    const config = await loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
      REDIS_URL: "redis://localhost:6379",
      JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
      JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem"
    });

    expect(config.identityHashPepper).toBe("weavenyc-dev-identity-pepper");
  });
});
