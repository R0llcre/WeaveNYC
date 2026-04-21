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

  it("accepts a missing RESOURCE_DIRECTORY_SERVICE_URL in production (monolith fallback)", async () => {
    // The resource-directory sidecar runs on GCP Cloud Run, which the AWS
    // App Runner VPC egress cannot reach. When the URL is absent the gateway
    // falls back to the in-process PgResourceDirectoryService (app.ts:265-269).
    // Other four service URLs remain mandatory; only resource-directory has
    // an in-gateway equivalent.
    const { loadConfig } = await import("../src/config.js");

    const config = await loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
      REDIS_URL: "redis://localhost:6379",
      JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
      JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
      INTERNAL_SERVICE_JWT_SECRET: "prod-secret",
      IDENTITY_HASH_PEPPER: "prod-pepper",
      ANCHOR_TOTP_ENCRYPTION_KEY: "prod-anchor-key",
      ALLOWED_CORS_ORIGINS: "https://weavenyc.org",
      POSTS_SERVICE_URL: "https://posts.example.com",
      MATCH_SERVICE_URL: "https://match.example.com",
      CHAT_SERVICE_URL: "https://chat.example.com",
      NOTIFICATIONS_SERVICE_URL: "https://notifications.example.com",
      // RESOURCE_DIRECTORY_SERVICE_URL intentionally absent
    });

    expect(config.internalServices.resourceDirectoryServiceUrl).toBeNull();
    expect(config.internalServices.postsServiceUrl).toBe("https://posts.example.com");
  });

  it("also accepts RESOURCE_DIRECTORY_SERVICE_URL set to the empty string (explicit unset)", async () => {
    // AWS App Runner's UpdateService MERGES RuntimeEnvironmentVariables
    // instead of replacing the map, so the only runtime mechanism to
    // "remove" an env var is to PUT an empty string. The
    // emptyStringToUndefined preprocessor + optional required-list keeps
    // this a valid config.
    const { loadConfig } = await import("../src/config.js");

    const config = await loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
      REDIS_URL: "redis://localhost:6379",
      JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
      JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
      INTERNAL_SERVICE_JWT_SECRET: "prod-secret",
      IDENTITY_HASH_PEPPER: "prod-pepper",
      ANCHOR_TOTP_ENCRYPTION_KEY: "prod-anchor-key",
      ALLOWED_CORS_ORIGINS: "https://weavenyc.org",
      POSTS_SERVICE_URL: "https://posts.example.com",
      MATCH_SERVICE_URL: "https://match.example.com",
      CHAT_SERVICE_URL: "https://chat.example.com",
      NOTIFICATIONS_SERVICE_URL: "https://notifications.example.com",
      RESOURCE_DIRECTORY_SERVICE_URL: "",
    });

    expect(config.internalServices.resourceDirectoryServiceUrl).toBeNull();
  });

  it("honors USE_MONOLITH_RESOURCE_DIRECTORY=1 override even when URL is set", async () => {
    // Ops escape hatch. App Runner's UpdateService MERGE semantics mean
    // empty-stringing RESOURCE_DIRECTORY_SERVICE_URL on a running service
    // is silently dropped. The override flag is additive (new key) so it
    // can be flipped via UpdateService without touching the URL. When set,
    // the resolved resourceDirectoryServiceUrl becomes null even with a
    // non-null URL.
    const { loadConfig } = await import("../src/config.js");

    const config = await loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
      REDIS_URL: "redis://localhost:6379",
      JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
      JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
      INTERNAL_SERVICE_JWT_SECRET: "prod-secret",
      IDENTITY_HASH_PEPPER: "prod-pepper",
      ANCHOR_TOTP_ENCRYPTION_KEY: "prod-anchor-key",
      ALLOWED_CORS_ORIGINS: "https://weavenyc.org",
      POSTS_SERVICE_URL: "https://posts.example.com",
      MATCH_SERVICE_URL: "https://match.example.com",
      CHAT_SERVICE_URL: "https://chat.example.com",
      NOTIFICATIONS_SERVICE_URL: "https://notifications.example.com",
      RESOURCE_DIRECTORY_SERVICE_URL: "https://resource-directory.example.com",
      USE_MONOLITH_RESOURCE_DIRECTORY: "1",
    });

    expect(config.internalServices.resourceDirectoryServiceUrl).toBeNull();
  });

  it("USE_MONOLITH_RESOURCE_DIRECTORY=0 is explicit opt-out (URL wins)", async () => {
    const { loadConfig } = await import("../src/config.js");

    const config = await loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
      REDIS_URL: "redis://localhost:6379",
      JWT_SIGNING_PRIVATE_KEY: "./infra/dev/jwt-private.pem",
      JWT_SIGNING_PUBLIC_KEY: "./infra/dev/jwt-public.pem",
      INTERNAL_SERVICE_JWT_SECRET: "prod-secret",
      IDENTITY_HASH_PEPPER: "prod-pepper",
      ANCHOR_TOTP_ENCRYPTION_KEY: "prod-anchor-key",
      ALLOWED_CORS_ORIGINS: "https://weavenyc.org",
      POSTS_SERVICE_URL: "https://posts.example.com",
      MATCH_SERVICE_URL: "https://match.example.com",
      CHAT_SERVICE_URL: "https://chat.example.com",
      NOTIFICATIONS_SERVICE_URL: "https://notifications.example.com",
      RESOURCE_DIRECTORY_SERVICE_URL: "https://resource-directory.example.com",
      USE_MONOLITH_RESOURCE_DIRECTORY: "0",
    });

    expect(config.internalServices.resourceDirectoryServiceUrl).toBe(
      "https://resource-directory.example.com",
    );
  });
});
