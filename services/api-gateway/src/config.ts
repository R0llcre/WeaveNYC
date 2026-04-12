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
  LOG_LEVEL: z.string().default('info'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  PWA_PORT: z.coerce.number().int().positive().default(3000),
  PWA_BASE_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1).default('postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_SIGNING_PRIVATE_KEY: z.string().default('./infra/dev/jwt-private.pem'),
  JWT_SIGNING_PUBLIC_KEY: z.string().default('./infra/dev/jwt-public.pem'),
  JWT_ISSUER: z.string().default('weavenyc-api-gateway'),
  JWT_ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  [authIdentityHashPepperEnvVar]: z.string().min(1).optional(),
  [anchorTotpEncryptionKeyEnvVar]: z.string().min(1).optional()
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
  identityHashPepper: string;
  anchorTotpEncryptionKey: string;
}

export async function loadConfig(source: NodeJS.ProcessEnv = process.env): Promise<AppConfig> {
  const workspaceEnv = loadWorkspaceEnv();
  const env = envSchema.parse({
    ...workspaceEnv,
    ...source
  });
  const sourceIdentityPepper = source[authIdentityHashPepperEnvVar]?.trim();
  const workspaceIdentityPepper = workspaceEnv[authIdentityHashPepperEnvVar]?.trim();
  const sourceAnchorTotpKey = source[anchorTotpEncryptionKeyEnvVar]?.trim();
  const workspaceAnchorTotpKey = workspaceEnv[anchorTotpEncryptionKeyEnvVar]?.trim();
  const identityHashPepper =
    env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
      ? sourceIdentityPepper ?? workspaceIdentityPepper
      : sourceIdentityPepper;
  const anchorTotpEncryptionKey =
    env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
      ? sourceAnchorTotpKey ?? workspaceAnchorTotpKey
      : sourceAnchorTotpKey;

  if (!identityHashPepper) {
    throw new Error(`Missing required environment variable: ${authIdentityHashPepperEnvVar}`);
  }

  if (!anchorTotpEncryptionKey) {
    throw new Error(`Missing required environment variable: ${anchorTotpEncryptionKeyEnvVar}`);
  }

  if (env.NODE_ENV === 'production' && identityHashPepper === devIdentityHashPepper) {
    throw new Error(`${authIdentityHashPepperEnvVar} must not use the checked-in development/test sample in production`);
  }
  if (env.NODE_ENV === 'production' && anchorTotpEncryptionKey === devAnchorTotpEncryptionKey) {
    throw new Error(`${anchorTotpEncryptionKeyEnvVar} must not use the checked-in development/test sample in production`);
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
    identityHashPepper,
    anchorTotpEncryptionKey
  };
}
