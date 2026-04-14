const DEV_INTERNAL_SERVICE_JWT_SECRET = "weavenyc-dev-internal-service-jwt-secret";

export type ChatConfig = {
  env: "development" | "test" | "production";
  server: {
    host: string;
    port: number;
  };
  databaseUrl: string;
  internalJwt: {
    issuer: string;
    secret: string;
  };
  runtime: {
    serviceName: "chat-service";
    version: string;
  };
};

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? `${fallback}`, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid port: ${value ?? fallback}`);
  }

  return parsed;
}

export function loadChatConfig(source: NodeJS.ProcessEnv = process.env): ChatConfig {
  const env = (source.NODE_ENV ?? "development") as ChatConfig["env"];
  const internalJwtSecret =
    source.INTERNAL_SERVICE_JWT_SECRET?.trim() ??
    (env === "development" || env === "test" ? DEV_INTERNAL_SERVICE_JWT_SECRET : "");

  if (!internalJwtSecret) {
    throw new Error("Missing required environment variable: INTERNAL_SERVICE_JWT_SECRET");
  }

  if (env === "production" && internalJwtSecret === DEV_INTERNAL_SERVICE_JWT_SECRET) {
    throw new Error(
      "INTERNAL_SERVICE_JWT_SECRET must not use the checked-in development/test sample in production",
    );
  }

  return {
    env,
    server: {
      host: source.HOST ?? "127.0.0.1",
      port: parsePort(source.PORT, 4103),
    },
    databaseUrl:
      source.DATABASE_URL ?? "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
    internalJwt: {
      issuer: source.INTERNAL_SERVICE_JWT_ISSUER?.trim() ?? "weavenyc-api-gateway:internal",
      secret: internalJwtSecret,
    },
    runtime: {
      serviceName: "chat-service",
      version: source.npm_package_version ?? process.env.npm_package_version ?? "0.1.0",
    },
  };
}
