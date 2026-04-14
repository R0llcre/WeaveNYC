import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import type { NotificationsConfig, NotificationsProviderMode } from './types.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));

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

const workspaceRoot = findWorkspaceRoot(moduleDir);
const devInternalJwtSecret = 'weavenyc-dev-internal-service-jwt-secret';
const devDemoBaseUrl = 'http://localhost:3000';
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

function stripProductionWorkspaceEnv(workspaceEnv: Record<string, string>) {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(workspaceEnv)) {
    if (
      key.startsWith('TWILIO_') ||
      key.startsWith('RESEND_') ||
      key === 'NOTIFICATIONS_PROVIDER_MODE' ||
      key === 'NOTIFICATIONS_INTERNAL_JWT_SECRET' ||
      key === 'NOTIFICATIONS_DEMO_BASE_URL' ||
      key === 'INTERNAL_SERVICE_JWT_SECRET'
    ) {
      continue;
    }

    filtered[key] = value;
  }

  return filtered;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  NOTIFICATIONS_HOST: z.string().default('0.0.0.0'),
  NOTIFICATIONS_PORT: z.coerce.number().int().positive().default(4105),
  NOTIFICATIONS_PROVIDER_MODE: z.preprocess(emptyStringToUndefined, z.enum(['stub', 'real']).optional()),
  NOTIFICATIONS_INTERNAL_JWT_SECRET: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  INTERNAL_SERVICE_JWT_SECRET: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  NOTIFICATIONS_INTERNAL_JWT_ISSUER: z.string().default('weavenyc-api-gateway:internal'),
  NOTIFICATIONS_DEMO_BASE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  TWILIO_ACCOUNT_SID: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  TWILIO_AUTH_TOKEN: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  TWILIO_MESSAGING_SERVICE_SID: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  TWILIO_FROM_NUMBER: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  RESEND_API_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  RESEND_FROM_EMAIL: z.preprocess(emptyStringToUndefined, z.string().email().optional()),
});

export async function loadNotificationsConfig(source: NodeJS.ProcessEnv = process.env): Promise<NotificationsConfig> {
  const workspaceEnv = loadWorkspaceEnv();
  const nodeEnv = (source.NODE_ENV ?? workspaceEnv.NODE_ENV ?? 'development') as 'development' | 'test' | 'production';
  const env = envSchema.parse({
    ...(nodeEnv === 'production' ? stripProductionWorkspaceEnv(workspaceEnv) : workspaceEnv),
    ...source,
    NODE_ENV: nodeEnv,
  });

  const providerMode: NotificationsProviderMode =
    env.NOTIFICATIONS_PROVIDER_MODE ??
    (env.NODE_ENV === 'production' ? 'real' : 'stub');

  if (env.NODE_ENV === 'production' && providerMode !== 'real') {
    throw new Error('Notifications provider mode must be real in production');
  }

  const internalJwtSecret =
    env.NOTIFICATIONS_INTERNAL_JWT_SECRET ??
    env.INTERNAL_SERVICE_JWT_SECRET ??
    (env.NODE_ENV === 'production' ? undefined : devInternalJwtSecret);

  if (!internalJwtSecret) {
    throw new Error('Missing required environment variable: NOTIFICATIONS_INTERNAL_JWT_SECRET or INTERNAL_SERVICE_JWT_SECRET');
  }

  const demoBaseUrl = env.NOTIFICATIONS_DEMO_BASE_URL ?? devDemoBaseUrl;

  if (providerMode === 'real') {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error('Missing required Twilio credentials');
    }
    if (!env.TWILIO_MESSAGING_SERVICE_SID && !env.TWILIO_FROM_NUMBER) {
      throw new Error('Missing required Twilio sender configuration');
    }
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      throw new Error('Missing required Resend credentials');
    }
    if (!env.NOTIFICATIONS_DEMO_BASE_URL) {
      throw new Error('Missing required notifications callback base URL');
    }
  }

  if (env.NODE_ENV === 'production' && demoBaseUrl === devDemoBaseUrl) {
    throw new Error('NOTIFICATIONS_DEMO_BASE_URL must not use the checked-in development/test sample in production');
  }

  const twilio =
    providerMode === 'real'
      ? {
          accountSid: env.TWILIO_ACCOUNT_SID as string,
          authToken: env.TWILIO_AUTH_TOKEN as string,
          messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
          fromNumber: env.TWILIO_FROM_NUMBER,
        }
      : undefined;

  const resend =
    providerMode === 'real'
      ? {
          apiKey: env.RESEND_API_KEY as string,
          fromEmail: env.RESEND_FROM_EMAIL as string,
        }
      : undefined;

  return {
    env: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    server: {
      host: env.NOTIFICATIONS_HOST,
      port: env.NOTIFICATIONS_PORT,
    },
    internalJwt: {
      issuer: env.NOTIFICATIONS_INTERNAL_JWT_ISSUER,
      secret: internalJwtSecret,
    },
    providerMode,
    demoBaseUrl,
    twilio,
    resend,
  };
}
