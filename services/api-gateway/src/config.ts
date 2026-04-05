import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

import { z } from 'zod';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(packageRoot, '../..');

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
  DATABASE_URL: z.string().min(1).default('postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_SIGNING_PRIVATE_KEY: z.string().default('./infra/dev/jwt-private.pem'),
  JWT_SIGNING_PUBLIC_KEY: z.string().default('./infra/dev/jwt-public.pem'),
  JWT_ISSUER: z.string().default('weavenyc-api-gateway'),
  JWT_ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7)
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
  jwt: {
    issuer: string;
    accessTokenTtl: string;
    privateKeyPath: string;
    publicKeyPath: string;
    privateKey: string;
    publicKey: string;
  };
  refreshTokenTtlSeconds: number;
}

export async function loadConfig(source: NodeJS.ProcessEnv = process.env): Promise<AppConfig> {
  const env = envSchema.parse({
    ...loadWorkspaceEnv(),
    ...source
  });
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
    jwt: {
      issuer: env.JWT_ISSUER,
      accessTokenTtl: env.JWT_ACCESS_TOKEN_TTL,
      privateKeyPath,
      publicKeyPath,
      privateKey,
      publicKey
    },
    refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL_SECONDS
  };
}
