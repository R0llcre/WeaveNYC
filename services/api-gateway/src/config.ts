import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

import { z } from 'zod';
import { anchorTotpEncryptionKeyEnvVar, authIdentityHashPepperEnvVar } from '@weavenyc/shared';

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
  INTERNAL_SERVICE_JWT_SECRET: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  POSTS_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  MATCH_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  CHAT_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  RESOURCE_DIRECTORY_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  NOTIFICATIONS_SERVICE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
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
  const missingInternalServiceUrls =
    strictRuntime
      ? [
          ['POSTS_SERVICE_URL', env.POSTS_SERVICE_URL],
          ['MATCH_SERVICE_URL', env.MATCH_SERVICE_URL],
          ['CHAT_SERVICE_URL', env.CHAT_SERVICE_URL],
          ['RESOURCE_DIRECTORY_SERVICE_URL', env.RESOURCE_DIRECTORY_SERVICE_URL],
          ['NOTIFICATIONS_SERVICE_URL', env.NOTIFICATIONS_SERVICE_URL]
        ].filter(([, value]) => !value).map(([key]) => key)
      : [];
  if (missingInternalServiceUrls.length > 0) {
    throw new Error(
      `Missing required internal service URLs in staging/production: ${missingInternalServiceUrls.join(', ')}`
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
    identityHashPepper,
    anchorTotpEncryptionKey,
    internalServiceJwtSecret,
    internalServices: {
      postsServiceUrl: env.POSTS_SERVICE_URL ?? null,
      matchServiceUrl: env.MATCH_SERVICE_URL ?? null,
      chatServiceUrl: env.CHAT_SERVICE_URL ?? null,
      resourceDirectoryServiceUrl: env.RESOURCE_DIRECTORY_SERVICE_URL ?? null,
      notificationsServiceUrl: env.NOTIFICATIONS_SERVICE_URL ?? null,
    },
    runtime: {
      serviceName: 'api-gateway',
      version: process.env.npm_package_version ?? '0.1.0',
    },
  };
}
