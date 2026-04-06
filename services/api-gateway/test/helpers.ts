import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { InMemoryPostsService } from '@weavenyc/posts';
import type { ResourceListItem, ResourceSearchInput, ResourceSearchResult } from '@weavenyc/resource-directory';

import type { AppConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import type { AuthAbuseStore } from '../src/lib/identity.js';
import type { RefreshTokenStore } from '../src/lib/refresh-token-store.js';
import type { ResourceDirectoryService } from '../src/lib/resource-directory.js';
import type { SpeechProvider } from '../src/lib/speech-providers.js';
import type { UserStore } from '../src/lib/user-store.js';
import type {
  AuthenticatedUserRecord,
  UserLevel,
  UserRole
} from '../src/types.js';
import type { StoredRefreshSession } from '../src/types.js';

export class InMemoryUserStore implements UserStore {
  readonly users = new Map<string, AuthenticatedUserRecord>();
  readonly phoneIdentities = new Map<string, { hash: string; salt: string }>();
  readonly emailIdentities = new Map<string, { hash: string; salt: string }>();

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

  async verifyUserPhone(
    userId: string,
    phoneHash: string,
    phoneHashSalt: string
  ): Promise<AuthenticatedUserRecord | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.level = 'verified';
    this.users.set(userId, user);
    this.phoneIdentities.set(userId, {
      hash: phoneHash,
      salt: phoneHashSalt
    });
    return user;
  }

  async verifyUserEmail(
    userId: string,
    emailHash: string,
    emailHashSalt: string
  ): Promise<AuthenticatedUserRecord | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.level = 'verified';
    this.users.set(userId, user);
    this.emailIdentities.set(userId, {
      hash: emailHash,
      salt: emailHashSalt
    });
    return user;
  }

  async close(): Promise<void> {}
}

export class InMemoryAuthAbuseStore implements AuthAbuseStore {
  readonly anonymousDecisions = new Map<string, { allowed: boolean; retryAfterSeconds: number; remaining: number }>();
  readonly refreshDecisions = new Map<string, { allowed: boolean; retryAfterSeconds: number; remaining: number }>();
  readonly otpDecisions = new Map<string, { allowed: boolean; retryAfterSeconds: number; remaining: number }>();
  readonly cooldowns = new Set<string>();
  readonly seenAnonymousKeys: string[] = [];
  readonly seenRefreshKeys: string[] = [];
  readonly seenOtpKeys: string[] = [];

  async checkAnonymousAuth(ipAddress: string) {
    this.seenAnonymousKeys.push(ipAddress);
    return this.anonymousDecisions.get(ipAddress) ?? {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 999
    };
  }

  async checkRefreshAttempt(userId: string) {
    this.seenRefreshKeys.push(userId);
    return this.refreshDecisions.get(userId) ?? {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 999
    };
  }

  async checkOtpStart(userId: string, phoneHash: string) {
    const key = `${userId}:${phoneHash}`;
    this.seenOtpKeys.push(key);
    if (this.cooldowns.has(phoneHash)) {
      return {
        allowed: false,
        retryAfterSeconds: 3600,
        remaining: 0
      };
    }

    return this.otpDecisions.get(key) ?? {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 999
    };
  }

  async activateOtpCooldown(phoneHash: string) {
    this.cooldowns.add(phoneHash);
  }

  async close(): Promise<void> {}
}

export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  readonly sessions = new Map<string, StoredRefreshSession>();
  readonly revokedFamilies = new Set<string>();
  readonly usedTokens = new Map<string, { familyId: string; userId: string }>();
  readonly challenges = new Map<string, {
    challengeId: string;
    kind: 'otp' | 'magic_link';
    userId: string;
    identityHash: string;
    identitySalt: string;
    abuseHash: string | null;
    maskedDestination: string;
    codeOrToken: string;
    attemptsRemaining: number;
    expiresAt: number;
  }>();

  async ping(): Promise<void> {}

  async createSession(token: string, session: StoredRefreshSession): Promise<void> {
    this.sessions.set(token, session);
  }

  async inspectSession(token: string) {
    const session = this.sessions.get(token);
    if (session) {
      if (this.revokedFamilies.has(session.familyId)) {
        return {
          status: 'revoked' as const,
          familyId: session.familyId,
          userId: session.userId
        };
      }

      return {
        status: 'active' as const,
        session
      };
    }

    const replay = this.usedTokens.get(token);
    if (replay) {
      return {
        status: 'replayed' as const,
        familyId: replay.familyId,
        userId: replay.userId
      };
    }

    return {
      status: 'missing' as const
    };
  }

  async rotateSession(currentToken: string, nextToken: string) {
    const session = this.sessions.get(currentToken);
    if (!session) {
      const replay = this.usedTokens.get(currentToken);
      if (replay) {
        this.revokedFamilies.add(replay.familyId);
        return {
          status: 'replayed' as const,
          familyId: replay.familyId,
          userId: replay.userId
        };
      }

      return {
        status: 'missing' as const
      };
    }

    if (this.revokedFamilies.has(session.familyId)) {
      this.sessions.delete(currentToken);
      return {
        status: 'revoked' as const,
        familyId: session.familyId,
        userId: session.userId
      };
    }

    this.sessions.delete(currentToken);
    this.usedTokens.set(currentToken, {
      familyId: session.familyId,
      userId: session.userId
    });
    this.sessions.set(nextToken, session);

    return {
      status: 'rotated' as const,
      session
    };
  }

  async revokeUserSessions(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        this.revokedFamilies.add(session.familyId);
      }
    }
  }

  async createOtpChallenge(challenge: {
    challengeId: string;
    kind: 'otp';
    userId: string;
    identityHash: string;
    identitySalt: string;
    abuseHash: string | null;
    maskedDestination: string;
    codeOrToken: string;
    attemptsRemaining: number;
    expiresAt: number;
  }): Promise<void> {
    this.challenges.set(`otp:${challenge.challengeId}`, challenge);
  }

  async createMagicLinkChallenge(challenge: {
    challengeId: string;
    kind: 'magic_link';
    userId: string;
    identityHash: string;
    identitySalt: string;
    abuseHash: string | null;
    maskedDestination: string;
    codeOrToken: string;
    attemptsRemaining: number;
    expiresAt: number;
  }): Promise<void> {
    this.challenges.set(`magic_link:${challenge.challengeId}`, challenge);
  }

  async verifyChallenge(input: {
    challengeId: string;
    kind: 'otp' | 'magic_link';
    codeOrToken: string;
  }) {
    const key = `${input.kind}:${input.challengeId}`;
    const challenge = this.challenges.get(key);
    if (!challenge) {
      return { status: 'missing' as const };
    }

    if (challenge.expiresAt <= Date.now()) {
      this.challenges.delete(key);
      return { status: 'expired' as const };
    }

    if (challenge.codeOrToken !== input.codeOrToken) {
      challenge.attemptsRemaining -= 1;
      if (challenge.attemptsRemaining <= 0) {
        this.challenges.delete(key);
        return { status: 'exhausted' as const, challenge };
      }
      return { status: 'invalid' as const };
    }

    this.challenges.delete(key);
    return {
      status: 'verified' as const,
      challenge
    };
  }

  async close(): Promise<void> {}
}

export class InMemoryResourceDirectory implements ResourceDirectoryService {
  constructor(
    readonly items: ResourceListItem[] = [
      {
        providerId: '77777777-7777-4777-8777-777777777777',
        name: "St. Kilian's Social Ministry",
        type: 'pantry',
        address: '140 Elizabeth St., Farmingdale, NY 11735',
        city: 'Farmingdale',
        state: 'NY',
        zip: '11735',
        phone: '5167569656',
        languages: ['en', 'es'],
        source: 'island_harvest',
        sourceLabel: 'Island Harvest Pantry Finder',
        sourceUrl: 'https://storerocket.io/api/user/n0pjnLgp6V/locations',
        notes: 'Official pantry listing.',
        distanceMiles: 0.15,
        isOpenToday: true,
        isOpenNow: false,
        geoPrecision: 'street',
        weeklyHours: [
          { day: 'mon', windows: [{ opensAt: '09:00AM', closesAt: '12:00PM' }], closed: false },
          { day: 'tue', windows: [{ opensAt: '09:00AM', closesAt: '12:00PM' }], closed: false },
          { day: 'wed', windows: [{ opensAt: '09:00AM', closesAt: '12:00PM' }], closed: false },
          { day: 'thu', windows: [{ opensAt: '09:00AM', closesAt: '12:00PM' }], closed: false },
          { day: 'fri', windows: [], closed: true },
          { day: 'sat', windows: [], closed: true },
          { day: 'sun', windows: [], closed: true }
        ]
      },
      {
        providerId: '88888888-8888-4888-8888-888888888888',
        name: 'Hope for the Future',
        type: 'pantry',
        address: '131 Verdi Street, Farmingdale, NY 11735',
        city: 'Farmingdale',
        state: 'NY',
        zip: '11735',
        phone: '(631)752-5771',
        languages: ['en'],
        source: 'island_harvest',
        sourceLabel: 'Island Harvest Pantry Finder',
        sourceUrl: 'https://storerocket.io/api/user/n0pjnLgp6V/locations',
        notes: 'Official pantry listing.',
        distanceMiles: 1.99,
        isOpenToday: true,
        isOpenNow: false,
        geoPrecision: 'street',
        weeklyHours: [
          { day: 'mon', windows: [], closed: true },
          { day: 'tue', windows: [], closed: true },
          { day: 'wed', windows: [], closed: true },
          { day: 'thu', windows: [{ opensAt: '04:00PM', closesAt: '06:00PM' }], closed: false },
          { day: 'fri', windows: [], closed: true },
          { day: 'sat', windows: [], closed: true },
          { day: 'sun', windows: [], closed: true }
        ]
      },
      {
        providerId: '99999999-9999-4999-8999-999999999999',
        name: 'St. Martin of Tours - Bethpage',
        type: 'pantry',
        address: '208 Broadway, Bethpage, NY 11714',
        city: 'Bethpage',
        state: 'NY',
        zip: '11714',
        phone: '(516)931-7332',
        languages: ['en'],
        source: 'island_harvest',
        sourceLabel: 'Island Harvest Pantry Finder',
        sourceUrl: 'https://storerocket.io/api/user/n0pjnLgp6V/locations',
        notes: 'Nearby pantry.',
        distanceMiles: 1.81,
        isOpenToday: true,
        isOpenNow: false,
        geoPrecision: 'street',
        weeklyHours: [
          { day: 'mon', windows: [], closed: true },
          { day: 'tue', windows: [{ opensAt: '10:00AM', closesAt: '01:00PM' }], closed: false },
          { day: 'wed', windows: [], closed: true },
          { day: 'thu', windows: [{ opensAt: '10:00AM', closesAt: '01:00PM' }], closed: false },
          { day: 'fri', windows: [], closed: true },
          { day: 'sat', windows: [], closed: true },
          { day: 'sun', windows: [], closed: true }
        ]
      }
    ]
  ) {}

  async searchResources(input: ResourceSearchInput): Promise<ResourceSearchResult> {
    const filtered = this.items.filter((item) => {
      if (input.type && item.type !== input.type) {
        return false;
      }

      if (input.today && !item.isOpenToday) {
        return false;
      }

      if (input.openNow && !item.isOpenNow) {
        return false;
      }

      return true;
    });

    return {
      items: filtered.slice(0, input.limit ?? 20),
      nextCursor: null,
      sourceMode: 'fixture'
    };
  }

  async getResourceDetail(providerId: string): Promise<ResourceListItem | null> {
    return this.items.find((item) => item.providerId === providerId) ?? null;
  }

  async close(): Promise<void> {}
}

export class InMemorySpeechProvider implements SpeechProvider {
  async transcribe(input: {
    audio: Buffer;
    languageHint?: 'en' | 'es' | 'zh';
    transcriptHint?: string;
  }) {
    const transcript = (input.transcriptHint ?? input.audio.toString('utf8')) || 'demo transcript';
    return {
      transcript,
      language: input.languageHint ?? 'en',
      provider: 'server_fallback' as const
    };
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
    pwaBaseUrl: 'http://localhost:3000',
    jwt: {
      issuer: 'weavenyc-api-gateway-test',
      accessTokenTtl: '15m',
      privateKeyPath: '',
      publicKeyPath: '',
      privateKey: readFileSync(resolve(import.meta.dirname, '../../../infra/dev/jwt-private.pem'), 'utf8'),
      publicKey: readFileSync(resolve(import.meta.dirname, '../../../infra/dev/jwt-public.pem'), 'utf8')
    },
    refreshTokenTtlSeconds: 60 * 60 * 24 * 7,
    identityHashPepper: 'test-identity-pepper'
  };
}

export async function createTestApp(options: {
  authAbuseStore?: AuthAbuseStore;
  config?: AppConfig;
  postsService?: InMemoryPostsService;
  userStore?: UserStore;
  refreshTokenStore?: RefreshTokenStore;
  resourceDirectory?: ResourceDirectoryService;
  speechProvider?: SpeechProvider;
} = {}) {
  const authAbuseStore = options.authAbuseStore ?? new InMemoryAuthAbuseStore();
  const postsService = options.postsService ?? new InMemoryPostsService();
  const userStore = options.userStore ?? new InMemoryUserStore();
  const refreshTokenStore = options.refreshTokenStore ?? new InMemoryRefreshTokenStore();
  const resourceDirectory = options.resourceDirectory ?? new InMemoryResourceDirectory();
  const speechProvider = options.speechProvider ?? new InMemorySpeechProvider();

  const app = await buildApp({
    authAbuseStore,
    config: options.config ?? createTestConfig(),
    postsService,
    userStore,
    refreshTokenStore,
    resourceDirectory,
    speechProvider,
    logger: false
  });

  return {
    app,
    authAbuseStore,
    postsService,
    userStore,
    refreshTokenStore,
    resourceDirectory,
    speechProvider
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
