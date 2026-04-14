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
        "P2P_MDNS_DEMO_ENABLED=0",
        "INTERNAL_SERVICE_JWT_SECRET=weavenyc-dev-internal-service-jwt-secret",
        "IDENTITY_HASH_PEPPER=weavenyc-dev-identity-pepper",
        "ANCHOR_TOTP_ENCRYPTION_KEY=weavenyc-dev-anchor-totp-encryption-key"
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
        JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
        INTERNAL_SERVICE_JWT_SECRET: "staging-secret",
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
        INTERNAL_SERVICE_JWT_SECRET: "weavenyc-dev-internal-service-jwt-secret",
        IDENTITY_HASH_PEPPER: "weavenyc-dev-identity-pepper",
        ANCHOR_TOTP_ENCRYPTION_KEY: "weavenyc-dev-anchor-totp-encryption-key"
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
    expect(config.anchorTotpEncryptionKey).toBe("weavenyc-dev-anchor-totp-encryption-key");
    expect(config.internalServiceJwtSecret).toBe("weavenyc-dev-internal-service-jwt-secret");
    expect(config.p2pMdnsDemoEnabled).toBe(false);
  });

  it("loads the optional P2P mDNS demo flag", async () => {
    const { loadConfig } = await import("../src/config.js");

    const config = await loadConfig({
      NODE_ENV: "development",
      DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
      REDIS_URL: "redis://localhost:6379",
      JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
      JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
      P2P_MDNS_DEMO_ENABLED: "1",
    });

    expect(config.p2pMdnsDemoEnabled).toBe(true);
  });

  it("requires an explicit internal service jwt secret in production", async () => {
    const { loadConfig } = await import("../src/config.js");

    await expect(
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
        REDIS_URL: "redis://localhost:6379",
        JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
        JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
        IDENTITY_HASH_PEPPER: "staging-pepper",
        ANCHOR_TOTP_ENCRYPTION_KEY: "staging-anchor-key",
      }),
    ).rejects.toThrow("INTERNAL_SERVICE_JWT_SECRET");
  });

  it("rejects the checked-in internal service secret in production", async () => {
    const { loadConfig } = await import("../src/config.js");

    await expect(
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
        REDIS_URL: "redis://localhost:6379",
        JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
        JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
        INTERNAL_SERVICE_JWT_SECRET: "weavenyc-dev-internal-service-jwt-secret",
        IDENTITY_HASH_PEPPER: "staging-pepper",
        ANCHOR_TOTP_ENCRYPTION_KEY: "staging-anchor-key",
      }),
    ).rejects.toThrow("INTERNAL_SERVICE_JWT_SECRET must not use the checked-in development/test sample in staging/production");
  });

  it("requires split-runtime service URLs in production", async () => {
    const { loadConfig } = await import("../src/config.js");

    await expect(
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
        REDIS_URL: "redis://localhost:6379",
        JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
        JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
        INTERNAL_SERVICE_JWT_SECRET: "staging-secret",
        IDENTITY_HASH_PEPPER: "staging-pepper",
        ANCHOR_TOTP_ENCRYPTION_KEY: "staging-anchor-key",
      }),
    ).rejects.toThrow("Missing required internal service URLs in staging/production");
  });

  it("requires explicit split-runtime env when staging deploy profile is set", async () => {
    const { loadConfig } = await import("../src/config.js");

    await expect(
      loadConfig({
        NODE_ENV: "development",
        WEAVENYC_DEPLOY_PROFILE: "staging",
        DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
        REDIS_URL: "redis://localhost:6379",
        JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
        JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
      }),
    ).rejects.toThrow("IDENTITY_HASH_PEPPER");
  });

  it("rejects checked-in development secrets when staging deploy profile is set", async () => {
    const { loadConfig } = await import("../src/config.js");

    await expect(
      loadConfig({
        NODE_ENV: "development",
        WEAVENYC_DEPLOY_PROFILE: "staging",
        DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
        REDIS_URL: "redis://localhost:6379",
        JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
        JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
        INTERNAL_SERVICE_JWT_SECRET: "weavenyc-dev-internal-service-jwt-secret",
        IDENTITY_HASH_PEPPER: "weavenyc-dev-identity-pepper",
        ANCHOR_TOTP_ENCRYPTION_KEY: "weavenyc-dev-anchor-totp-encryption-key",
        POSTS_SERVICE_URL: "https://posts.example.com",
        MATCH_SERVICE_URL: "https://match.example.com",
        CHAT_SERVICE_URL: "https://chat.example.com",
        RESOURCE_DIRECTORY_SERVICE_URL: "https://resources.example.com",
        NOTIFICATIONS_SERVICE_URL: "https://notifications.example.com",
      }),
    ).rejects.toThrow("checked-in development/test sample");
  });

  it("requires all split-runtime service URLs when staging deploy profile is set", async () => {
    const { loadConfig } = await import("../src/config.js");

    await expect(
      loadConfig({
        NODE_ENV: "development",
        WEAVENYC_DEPLOY_PROFILE: "staging",
        DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
        REDIS_URL: "redis://localhost:6379",
        JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
        JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
        INTERNAL_SERVICE_JWT_SECRET: "staging-secret",
        IDENTITY_HASH_PEPPER: "staging-pepper",
        ANCHOR_TOTP_ENCRYPTION_KEY: "staging-anchor-key",
        POSTS_SERVICE_URL: "https://posts.example.com",
        MATCH_SERVICE_URL: "https://match.example.com",
      }),
    ).rejects.toThrow("Missing required internal service URLs in staging/production");
  });
});
