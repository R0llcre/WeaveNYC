const DEV_INTERNAL_SERVICE_JWT_SECRET = "weavenyc-dev-internal-service-jwt-secret";

export type ResourceDirectoryConfig = {
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
  sentry: {
    dsn: string | null;
    tracesSampleRate: number;
  };
  runtime: {
    serviceName: "resource-directory-service";
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

export function loadResourceDirectoryConfig(source: NodeJS.ProcessEnv = process.env): ResourceDirectoryConfig {
  const env = (source.NODE_ENV ?? "development") as ResourceDirectoryConfig["env"];
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

  const sentryDsnRaw = source.SENTRY_DSN?.trim();
  const sentryDsn = sentryDsnRaw && sentryDsnRaw.length > 0 ? sentryDsnRaw : null;
  const sentrySampleRate = Number.parseFloat(source.SENTRY_TRACES_SAMPLE_RATE ?? "");
  const tracesSampleRate = Number.isFinite(sentrySampleRate) && sentrySampleRate >= 0 && sentrySampleRate <= 1
    ? sentrySampleRate
    : 0.1;

  return {
    env,
    server: {
      host: source.HOST ?? "127.0.0.1",
      port: parsePort(source.PORT, 4104),
    },
    databaseUrl:
      source.DATABASE_URL ?? "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev",
    internalJwt: {
      issuer: source.INTERNAL_SERVICE_JWT_ISSUER?.trim() ?? "weavenyc-api-gateway:internal",
      secret: internalJwtSecret,
    },
    sentry: {
      dsn: sentryDsn,
      tracesSampleRate,
    },
    runtime: {
      serviceName: "resource-directory-service",
      version: source.npm_package_version ?? process.env.npm_package_version ?? "0.1.0",
    },
  };
}
