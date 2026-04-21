import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

import { z } from 'zod';
import { anchorTotpEncryptionKeyEnvVar, authIdentityHashPepperEnvVar } from '@weavenyc/shared';

const devCorsOriginPatterns = ['http://localhost:*', 'http://127.0.0.1:*'];

function resolveCorsAllowedOrigins(raw: string | undefined, strictRuntime: boolean): string[] {
  if (raw && raw.trim().length > 0) {
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
  return strictRuntime ? [] : [...devCorsOriginPatterns];
}

function findWorkspaceRoot(startDir: string) {
  let currentDir = startDir;

  while (true) {
    if (existsSync(resolve(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }

    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      throw new Error(`Unable to locate pnpm workspace root from ${startDir}`);
    }

    currentDir = parentDir;
  }
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = findWorkspaceRoot(moduleDir);
const devIdentityHashPepper = 'weavenyc-dev-identity-pepper';
const devAnchorTotpEncryptionKey = 'weavenyc-dev-anchor-totp-encryption-key';
const devInternalServiceJwtSecret = 'weavenyc-dev-internal-service-jwt-secret';
const emptyStringToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value;

function parseEnvFile(content: string): Record<string, string> {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce<Record<string, string>>((acc, line) => {
      const separator = line.indexOf('=');

      if (separator === -1) {
        return acc;
      }

      acc[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
      return acc;
    }, {});
}

function loadWorkspaceEnv(): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const fileName of ['.env.example', '.env', '.env.local']) {
    const filePath = resolve(workspaceRoot, fileName);
    if (existsSync(filePath)) {
      Object.assign(merged, parseEnvFile(readFileSync(filePath, 'utf8')));
    }
  }

  return merged;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WEAVENYC_DEPLOY_PROFILE: z.enum(['development', 'test', 'staging', 'production']).optional(),
  LOG_LEVEL: z.string().default('info'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  PWA_PORT: z.coerce.number().int().positive().default(3000),
  PWA_BASE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  DATABASE_URL: z.string().min(1).default('postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_SIGNING_PRIVATE_KEY: z.string().default('./infra/dev/jwt-private.pem'),
  JWT_SIGNING_PUBLIC_KEY: z.string().default('./infra/dev/jwt-public.pem'),
  JWT_ISSUER: z.string().default('weavenyc-api-gateway'),
  JWT_ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  P2P_MDNS_DEMO_ENABLED: z.enum(['0', '1']).default('0'),
  ALLOWED_CORS_ORIGINS: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  INTERNAL_SERVICE_JWT_SECRET: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  POSTS_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  MATCH_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  CHAT_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  RESOURCE_DIRECTORY_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  // USE_MONOLITH_RESOURCE_DIRECTORY=1 forces the gateway to fall back to the
  // in-process PgResourceDirectoryService regardless of whether
  // RESOURCE_DIRECTORY_SERVICE_URL is set. This is the pilot-stable setting
  // for AWS App Runner with VPC egress (the Cloud Run sidecar lives at an
  // external URL that VPC-routed egress cannot reach, and App Runner's
  // UpdateService MERGES env vars rather than replacing, so empty-stringing
  // the URL is silently ignored). The flag is independent of the URL value
  // so ops can flip it live without touching Cloud Run deploys.
  USE_MONOLITH_RESOURCE_DIRECTORY: z.preprocess(emptyStringToUndefined, z.enum(['0', '1']).optional()),
  NOTIFICATIONS_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  ENABLE_PURGE_JOB: z.preprocess(emptyStringToUndefined, z.enum(['0', '1']).optional()),
  PURGE_JOB_CRON: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  SENTRY_DSN: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  SENTRY_TRACES_SAMPLE_RATE: z.preprocess(emptyStringToUndefined, z.coerce.number().min(0).max(1).optional()),
  [authIdentityHashPepperEnvVar]: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  [anchorTotpEncryptionKeyEnvVar]: z.preprocess(emptyStringToUndefined, z.string().min(1).optional())
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  logLevel: string;
  server: {
    host: string;
    port: number;
  };
  databaseUrl: string;
  redisUrl: string;
  pwaBaseUrl: string;
  jwt: {
    issuer: string;
    accessTokenTtl: string;
    privateKeyPath: string;
    publicKeyPath: string;
    privateKey: string;
    publicKey: string;
  };
  refreshTokenTtlSeconds: number;
  p2pMdnsDemoEnabled: boolean;
  corsAllowedOrigins: string[];
  identityHashPepper: string;
  anchorTotpEncryptionKey: string;
  internalServiceJwtSecret: string;
  internalServices: {
    postsServiceUrl: string | null;
    matchServiceUrl: string | null;
    chatServiceUrl: string | null;
    resourceDirectoryServiceUrl: string | null;
    notificationsServiceUrl: string | null;
  };
  purgeJob: {
    enabled: boolean;
    schedule: string;
  };
  sentry: {
    dsn: string | null;
    tracesSampleRate: number;
  };
  runtime: {
    serviceName: 'api-gateway';
    version: string;
  };
}

export async function loadConfig(source: NodeJS.ProcessEnv = process.env): Promise<AppConfig> {
  const workspaceEnv = loadWorkspaceEnv();
  const env = envSchema.parse({
    ...workspaceEnv,
    ...source
  });
  const strictRuntime = env.NODE_ENV === 'production' || env.WEAVENYC_DEPLOY_PROFILE === 'staging' || env.WEAVENYC_DEPLOY_PROFILE === 'production';
  const sourceIdentityPepper = source[authIdentityHashPepperEnvVar]?.trim();
  const workspaceIdentityPepper = workspaceEnv[authIdentityHashPepperEnvVar]?.trim();
  const sourceAnchorTotpKey = source[anchorTotpEncryptionKeyEnvVar]?.trim();
  const workspaceAnchorTotpKey = workspaceEnv[anchorTotpEncryptionKeyEnvVar]?.trim();
  const identityHashPepper =
    strictRuntime
      ? sourceIdentityPepper
      : env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
      ? sourceIdentityPepper ?? workspaceIdentityPepper
      : sourceIdentityPepper;
  const anchorTotpEncryptionKey =
    strictRuntime
      ? sourceAnchorTotpKey
      : env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
      ? sourceAnchorTotpKey ?? workspaceAnchorTotpKey
      : sourceAnchorTotpKey;
  const sourceInternalServiceJwtSecret = source.INTERNAL_SERVICE_JWT_SECRET?.trim();
  const workspaceInternalServiceJwtSecret = workspaceEnv.INTERNAL_SERVICE_JWT_SECRET?.trim();
  const internalServiceJwtSecret =
    strictRuntime
      ? sourceInternalServiceJwtSecret
      : env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
      ? sourceInternalServiceJwtSecret ?? workspaceInternalServiceJwtSecret
      : sourceInternalServiceJwtSecret;

  if (!identityHashPepper) {
    throw new Error(`Missing required environment variable: ${authIdentityHashPepperEnvVar}`);
  }

  if (!anchorTotpEncryptionKey) {
    throw new Error(`Missing required environment variable: ${anchorTotpEncryptionKeyEnvVar}`);
  }

  if (!internalServiceJwtSecret) {
    throw new Error('Missing required environment variable: INTERNAL_SERVICE_JWT_SECRET');
  }

  if (strictRuntime && identityHashPepper === devIdentityHashPepper) {
    throw new Error(`${authIdentityHashPepperEnvVar} must not use the checked-in development/test sample in staging/production`);
  }
  if (strictRuntime && anchorTotpEncryptionKey === devAnchorTotpEncryptionKey) {
    throw new Error(`${anchorTotpEncryptionKeyEnvVar} must not use the checked-in development/test sample in staging/production`);
  }
  if (strictRuntime && internalServiceJwtSecret === devInternalServiceJwtSecret) {
    throw new Error('INTERNAL_SERVICE_JWT_SECRET must not use the checked-in development/test sample in staging/production');
  }
  // RESOURCE_DIRECTORY_SERVICE_URL is intentionally optional even in strict
  // runtime: when unset (or empty), the gateway falls back to the in-process
  // PgResourceDirectoryService path (see app.ts:265-269). This lets prod
  // bypass the GCP Cloud Run sidecar when the VPC egress topology cannot
  // reach external internet — the monolith path is functionally identical
  // (same PgResourceDirectoryService implementation the Cloud Run service
  // uses internally) and is the chosen pilot configuration while Redis
  // lives in ElastiCache (VPC-only). Other four internal service URLs
  // remain required because the matching/posts/chat/notification domains
  // do NOT yet have in-gateway fallbacks.
  const missingInternalServiceUrls =
    strictRuntime
      ? [
          ['POSTS_SERVICE_URL', env.POSTS_SERVICE_URL],
          ['MATCH_SERVICE_URL', env.MATCH_SERVICE_URL],
          ['CHAT_SERVICE_URL', env.CHAT_SERVICE_URL],
          ['NOTIFICATIONS_SERVICE_URL', env.NOTIFICATIONS_SERVICE_URL]
        ].filter(([, value]) => !value).map(([key]) => key)
      : [];
  if (missingInternalServiceUrls.length > 0) {
    throw new Error(
      `Missing required internal service URLs in staging/production: ${missingInternalServiceUrls.join(', ')}`
    );
  }

  const corsAllowedOrigins = resolveCorsAllowedOrigins(env.ALLOWED_CORS_ORIGINS, strictRuntime);
  if (strictRuntime && corsAllowedOrigins.length === 0) {
    throw new Error(
      'ALLOWED_CORS_ORIGINS must be set in staging/production (e.g. "https://*.weavenyc.org")'
    );
  }

  const privateKeyPath = resolve(workspaceRoot, env.JWT_SIGNING_PRIVATE_KEY);
  const publicKeyPath = resolve(workspaceRoot, env.JWT_SIGNING_PUBLIC_KEY);
  const [privateKey, publicKey] = await Promise.all([
    readFile(privateKeyPath, 'utf8'),
    readFile(publicKeyPath, 'utf8')
  ]);

  return {
    env: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    server: {
      host: env.API_HOST,
      port: env.API_PORT
    },
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    pwaBaseUrl: env.PWA_BASE_URL ?? `http://localhost:${env.PWA_PORT}`,
    jwt: {
      issuer: env.JWT_ISSUER,
      accessTokenTtl: env.JWT_ACCESS_TOKEN_TTL,
      privateKeyPath,
      publicKeyPath,
      privateKey,
      publicKey
    },
    refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL_SECONDS,
    p2pMdnsDemoEnabled: env.P2P_MDNS_DEMO_ENABLED === '1',
    corsAllowedOrigins,
    identityHashPepper,
    anchorTotpEncryptionKey,
    internalServiceJwtSecret,
    internalServices: {
      postsServiceUrl: env.POSTS_SERVICE_URL ?? null,
      matchServiceUrl: env.MATCH_SERVICE_URL ?? null,
      chatServiceUrl: env.CHAT_SERVICE_URL ?? null,
      // Monolith override (USE_MONOLITH_RESOURCE_DIRECTORY=1) hard-nulls the
      // URL so app.ts picks createPgResourceDirectoryService regardless of
      // what's set in the env map.
      resourceDirectoryServiceUrl:
        env.USE_MONOLITH_RESOURCE_DIRECTORY === '1'
          ? null
          : env.RESOURCE_DIRECTORY_SERVICE_URL ?? null,
      notificationsServiceUrl: env.NOTIFICATIONS_SERVICE_URL ?? null,
    },
    purgeJob: {
      enabled: env.ENABLE_PURGE_JOB === '1'
        ? true
        : env.ENABLE_PURGE_JOB === '0'
          ? false
          : strictRuntime,
      schedule: env.PURGE_JOB_CRON ?? '0 0 * * *',
    },
    sentry: {
      dsn: env.SENTRY_DSN ?? null,
      tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
    },
    runtime: {
      serviceName: 'api-gateway',
      version: process.env.npm_package_version ?? '0.1.0',
    },
  };
}
