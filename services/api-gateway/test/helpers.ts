import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import type { AppConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import type { RefreshTokenStore } from '../src/lib/refresh-token-store.js';
import type { UserStore } from '../src/lib/user-store.js';
import type {
  AuthenticatedUserRecord,
  StoredRefreshSession,
  UserLevel,
  UserRole
} from '../src/types.js';

export class InMemoryUserStore implements UserStore {
  readonly users = new Map<string, AuthenticatedUserRecord>();

  async ping(): Promise<void> {}

  async createAnonymousUser(deviceId: string): Promise<AuthenticatedUserRecord> {
    void deviceId;
    const user: AuthenticatedUserRecord = {
      userId: randomUUID(),
      level: 'anonymous',
      role: 'user',
      status: 'active',
      communityIds: []
    };

    this.users.set(user.userId, user);
    return user;
  }

  async getAuthUserById(userId: string): Promise<AuthenticatedUserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  async close(): Promise<void> {}
}

export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  readonly sessions = new Map<string, StoredRefreshSession>();

  async ping(): Promise<void> {}

  async store(token: string, session: StoredRefreshSession): Promise<void> {
    this.sessions.set(token, session);
  }

  async close(): Promise<void> {}
}

export function createTestConfig(): AppConfig {
  return {
    env: 'test',
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 4000
    },
    databaseUrl: 'postgres://test:test@127.0.0.1:5432/test',
    redisUrl: 'redis://127.0.0.1:6379',
    jwt: {
      issuer: 'weavenyc-api-gateway-test',
      accessTokenTtl: '15m',
      privateKeyPath: '',
      publicKeyPath: '',
      privateKey: readFileSync(resolve(import.meta.dirname, '../../../infra/dev/jwt-private.pem'), 'utf8'),
      publicKey: readFileSync(resolve(import.meta.dirname, '../../../infra/dev/jwt-public.pem'), 'utf8')
    },
    refreshTokenTtlSeconds: 60 * 60 * 24 * 7
  };
}

export async function createTestApp(options: {
  userStore?: UserStore;
  refreshTokenStore?: RefreshTokenStore;
} = {}) {
  const userStore = options.userStore ?? new InMemoryUserStore();
  const refreshTokenStore = options.refreshTokenStore ?? new InMemoryRefreshTokenStore();

  const app = await buildApp({
    config: createTestConfig(),
    userStore,
    refreshTokenStore,
    logger: false
  });

  return {
    app,
    userStore,
    refreshTokenStore
  };
}

export function createUserRecord(input: {
  userId?: string;
  level?: UserLevel;
  role?: UserRole;
  communityIds?: string[];
} = {}): AuthenticatedUserRecord {
  return {
    userId: input.userId ?? randomUUID(),
    level: input.level ?? 'anonymous',
    role: input.role ?? 'user',
    status: 'active',
    communityIds: input.communityIds ?? []
  };
}
