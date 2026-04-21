import { createHash, randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  hashPhoneAbuseKey,
  hashIdentity
} from '../src/lib/identity.js';
import type { AuthTokenClaims } from '../src/types.js';
import {
  InMemoryAuthAbuseStore,
  InMemoryRefreshTokenStore,
  InMemoryUserStore,
  createTestApp,
  createTestConfig,
  createUserRecord,
} from './helpers.js';

describe('POST /v1/auth/anonymous', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('creates an anonymous user row and returns signed tokens', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({
      userStore,
      refreshTokenStore
    });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anonymous',
      payload: {
        device_id: randomUUID()
      }
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.refresh_token).toMatch(/^rt_/);
    expect(body.user.level).toBe('anonymous');
    expect(userStore.users.size).toBe(1);
    expect(refreshTokenStore.sessions.has(body.refresh_token)).toBe(true);

    const claims = await app.jwt.verify<AuthTokenClaims>(body.access_token);
    expect(claims.level).toBe('anonymous');
    expect(claims.role).toBe('user');
    expect(claims.sub).toBe(body.user.user_id);
  });

  it('rotates refresh tokens and rejects token replay', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/anonymous',
      payload: {
        device_id: randomUUID()
      }
    });
    const session = sessionResponse.json();

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refresh_token: session.refresh_token
      }
    });

    expect(refreshResponse.statusCode).toBe(200);
    const refreshed = refreshResponse.json();
    expect(refreshed.refresh_token).not.toBe(session.refresh_token);

    const replayResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refresh_token: session.refresh_token
      }
    });

    expect(replayResponse.statusCode).toBe(401);
  });

  it('rejects refresh for suspended users and revokes the session family', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({
      userStore,
      refreshTokenStore,
    });
    apps.push(app);

    const session = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/anonymous',
        payload: {
          device_id: randomUUID(),
        },
      })
    ).json();

    const user = userStore.users.get(session.user.user_id);
    if (!user) {
      throw new Error('expected anonymous user to exist');
    }
    user.status = 'suspended';
    userStore.users.set(user.userId, user);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refresh_token: session.refresh_token,
      },
    });

    expect(response.statusCode).toBe(401);
    const stored = refreshTokenStore.sessions.get(session.refresh_token);
    expect(stored).toBeDefined();
    expect(refreshTokenStore.revokedFamilies.has(stored!.familyId)).toBe(true);
  });

  it('does not upgrade a verified refresh family into anchor scope', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({
      userStore,
      refreshTokenStore,
    });
    apps.push(app);

    const anonymousSession = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/anonymous',
        payload: {
          device_id: randomUUID(),
        },
      })
    ).json();

    const otpStart = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/start',
        headers: {
          authorization: `Bearer ${anonymousSession.access_token}`,
        },
        payload: {
          phone: '+15165550101',
        },
      })
    ).json();

    const verifiedSession = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/verify',
        headers: {
          authorization: `Bearer ${anonymousSession.access_token}`,
        },
        payload: {
          challenge_id: otpStart.challenge_id,
          code: otpStart.demo_code,
        },
      })
    ).json();

    const user = userStore.users.get(verifiedSession.user.user_id);
    if (!user) {
      throw new Error('expected verified user to exist');
    }
    user.level = 'anchor';
    user.role = 'anchor';
    user.anchorCommunityId = '44444444-4444-4444-8444-444444444444';
    userStore.users.set(user.userId, user);

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refresh_token: verifiedSession.refresh_token,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json().user.level).toBe('verified');
    const claims = await app.jwt.verify<AuthTokenClaims>(refreshResponse.json().access_token);
    expect(claims.level).toBe('verified');
    expect(claims.role).toBe('user');
    expect(claims.anchor_community_id).toBeUndefined();
  });

  it('rate limits anonymous session creation attempts', async () => {
    const authAbuseStore = new InMemoryAuthAbuseStore();
    authAbuseStore.anonymousDecisions.set('127.0.0.1', {
      allowed: false,
      retryAfterSeconds: 42,
      remaining: 0
    });

    const { app } = await createTestApp({ authAbuseStore });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anonymous',
      payload: {
        device_id: randomUUID()
      }
    });

    expect(response.statusCode).toBe(429);
    expect(response.json().message).toContain('42s');
  });

  it('rate limits refresh attempts before rotation runs', async () => {
    const authAbuseStore = new InMemoryAuthAbuseStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({
      authAbuseStore,
      refreshTokenStore
    });
    apps.push(app);

    const session = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/anonymous',
        payload: {
          device_id: randomUUID()
        }
      })
    ).json();

    authAbuseStore.refreshDecisions.set(session.user.user_id, {
      allowed: false,
      retryAfterSeconds: 21,
      remaining: 0
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refresh_token: session.refresh_token
      }
    });

    expect(response.statusCode).toBe(429);
    expect(refreshTokenStore.usedTokens.size).toBe(0);
  });

  it('upgrades an authenticated anonymous session with OTP', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({
      userStore,
      refreshTokenStore
    });
    apps.push(app);

    const session = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/anonymous',
        payload: {
          device_id: randomUUID()
        }
      })
    ).json();

    const startResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/start',
      headers: {
        authorization: `Bearer ${session.access_token}`
      },
      payload: {
        phone: '+15165550101'
      }
    });

    expect(startResponse.statusCode).toBe(200);
    const challenge = startResponse.json();

    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      headers: {
        authorization: `Bearer ${session.access_token}`
      },
      payload: {
        challenge_id: challenge.challenge_id,
        code: challenge.demo_code
      }
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json().user.level).toBe('verified');
    expect(userStore.phoneIdentities.get(session.user.user_id)?.hash).toHaveLength(64);
    expect(userStore.phoneIdentities.get(session.user.user_id)?.salt).toHaveLength(32);
    expect(refreshTokenStore.challenges.get(`otp:${challenge.challenge_id}`)).toBeUndefined();
  });

  it('rate limits OTP start with combined user and phone abuse keys', async () => {
    const authAbuseStore = new InMemoryAuthAbuseStore();
    const { app } = await createTestApp({ authAbuseStore });
    apps.push(app);

    const session = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/anonymous',
        payload: {
          device_id: randomUUID()
        }
      })
    ).json();

    const expectedHash = hashPhoneAbuseKey('+15165550101', 'test-identity-pepper');
    authAbuseStore.otpDecisions.set(`${session.user.user_id}:${expectedHash}`, {
      allowed: false,
      retryAfterSeconds: 60,
      remaining: 0
    });

    const startResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/start',
      headers: {
        authorization: `Bearer ${session.access_token}`
      },
      payload: {
        phone: '+15165550101'
      }
    });

    expect(startResponse.statusCode).toBe(429);
    expect(startResponse.json().message).toContain('60s');
    expect(authAbuseStore.seenOtpKeys).toContain(`${session.user.user_id}:${expectedHash}`);
  });

  it('puts a phone on cooldown after exhausting OTP attempts', async () => {
    const authAbuseStore = new InMemoryAuthAbuseStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({
      authAbuseStore,
      refreshTokenStore
    });
    apps.push(app);

    const session = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/anonymous',
        payload: {
          device_id: randomUUID()
        }
      })
    ).json();

    const startResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/start',
      headers: {
        authorization: `Bearer ${session.access_token}`
      },
      payload: {
        phone: '+15165550101'
      }
    });

    const challenge = startResponse.json();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/verify',
        headers: {
          authorization: `Bearer ${session.access_token}`
        },
        payload: {
          challenge_id: challenge.challenge_id,
          code: '000000'
        }
      });

      expect(response.statusCode).toBe(400);
    }

    const secondStart = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/start',
      headers: {
        authorization: `Bearer ${session.access_token}`
      },
      payload: {
        phone: '+15165550101'
      }
    });

    expect(secondStart.statusCode).toBe(429);
  });

  it('rejects expired OTP challenges', async () => {
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({
      refreshTokenStore
    });
    apps.push(app);

    const session = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/anonymous',
        payload: {
          device_id: randomUUID()
        }
      })
    ).json();

    const startResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/start',
      headers: {
        authorization: `Bearer ${session.access_token}`
      },
      payload: {
        phone: '+15165550101'
      }
    });

    const challenge = startResponse.json();
    const stored = refreshTokenStore.challenges.get(`otp:${challenge.challenge_id}`);
    if (!stored) {
      throw new Error('OTP challenge not stored');
    }

    stored.expiresAt = Date.now() - 1;

    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      headers: {
        authorization: `Bearer ${session.access_token}`
      },
      payload: {
        challenge_id: challenge.challenge_id,
        code: challenge.demo_code
      }
    });

    expect(verifyResponse.statusCode).toBe(400);
  });

  it('upgrades an anonymous session with a magic-link fallback from the link payload alone', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const session = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/anonymous',
        payload: {
          device_id: randomUUID()
        }
      })
    ).json();

    const startResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/magic-link/start',
      headers: {
        authorization: `Bearer ${session.access_token}`
      },
      payload: {
        email: 'neighbor@example.com'
      }
    });

    expect(startResponse.statusCode).toBe(200);
    const challenge = startResponse.json();

    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/magic-link/verify',
      payload: {
        challenge_id: challenge.challenge_id,
        token: challenge.demo_token
      }
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json().user.level).toBe('verified');
    expect(challenge.demo_url).toContain(`challenge_id=${challenge.challenge_id}`);
  });

  it('derives the magic-link demo URL from runtime config', async () => {
    const config = {
      ...createTestConfig(),
      pwaBaseUrl: 'https://pilot.weavenyc.example'
    };
    const { app } = await createTestApp({ config });
    apps.push(app);

    const session = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/anonymous',
        payload: {
          device_id: randomUUID()
        }
      })
    ).json();

    const startResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/magic-link/start',
      headers: {
        authorization: `Bearer ${session.access_token}`
      },
      payload: {
        email: 'neighbor@example.com'
      }
    });

    expect(startResponse.statusCode).toBe(200);
    expect(startResponse.json().demo_url).toContain('https://pilot.weavenyc.example/verify?');
  });

  it('hashes identities with namespace, salt, and pepper inputs', () => {
    const first = hashIdentity('neighbor@example.com', {
      namespace: 'email',
      salt: 'user-a',
      pepper: 'pepper-a'
    });
    const second = hashIdentity('neighbor@example.com', {
      namespace: 'email',
      salt: 'user-b',
      pepper: 'pepper-a'
    });
    const third = hashIdentity('neighbor@example.com', {
      namespace: 'email',
      salt: 'user-a',
      pepper: 'pepper-b'
    });

    expect(first).toHaveLength(64);
    expect(first).not.toBe(second);
    expect(first).not.toBe(third);
  });
});

describe('POST /v1/auth/anchor/session/recovery', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  function hashRecoveryCode(code: string) {
    return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  }

  async function setupAnchorSession({
    authAbuseStore,
    userStore,
    recoveryCode,
    extraCodes = [],
  }: {
    authAbuseStore?: InMemoryAuthAbuseStore;
    userStore: InMemoryUserStore;
    recoveryCode: string;
    extraCodes?: string[];
  }) {
    const communityId = '44444444-4444-4444-8444-444444444444';
    const anchorUser = createUserRecord({
      userId: '33333333-3333-4333-8333-333333333333',
      level: 'anchor',
      role: 'anchor',
      communityIds: [communityId],
      anchorCommunityId: communityId,
      mfaVerifiedAt: new Date().toISOString(),
    });
    userStore.users.set(anchorUser.userId, anchorUser);
    userStore.anchors.set(communityId, {
      anchorId: randomUUID(),
      userId: anchorUser.userId,
      communityId,
      orgName: 'Test Anchor Org',
      status: 'active',
      totpSecretCiphertext: null,
      recoveryCodesHashes: [recoveryCode, ...extraCodes].map(hashRecoveryCode),
      activatedAt: new Date().toISOString(),
      lastMfaAt: new Date().toISOString(),
    });

    const { app } = await createTestApp({ userStore, authAbuseStore });
    apps.push(app);

    const accessToken = app.jwt.sign(
      {
        sub: anchorUser.userId,
        level: anchorUser.level,
        role: anchorUser.role,
        community_ids: anchorUser.communityIds,
        anchor_community_id: anchorUser.anchorCommunityId ?? undefined,
        mfa_verified_at: anchorUser.mfaVerifiedAt,
      },
      {
        algorithm: 'RS256',
        iss: app.config.jwt.issuer,
        expiresIn: app.config.jwt.accessTokenTtl,
      },
    );

    return { app, accessToken, communityId, anchorUser };
  }

  it('consumes a valid recovery code and returns remaining_attempts', async () => {
    const userStore = new InMemoryUserStore();
    const recoveryCode = 'ABCD-1111';
    const { app, accessToken, communityId } = await setupAnchorSession({
      userStore,
      recoveryCode,
      extraCodes: ['BCDE-2222', 'CDEF-3333'],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anchor/session/recovery',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        community_id: communityId,
        recovery_code: recoveryCode,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.level).toBe('anchor');
    expect(body.issued_via).toBe('anchor_session');
    expect(body.remaining_attempts).toBeGreaterThanOrEqual(0);
    expect(body.remaining_attempts).toBeLessThanOrEqual(5);
  });

  it('returns 400 with remaining_attempts when the recovery code is invalid', async () => {
    const userStore = new InMemoryUserStore();
    const { app, accessToken, communityId } = await setupAnchorSession({
      userStore,
      recoveryCode: 'ABCD-1111',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anchor/session/recovery',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        community_id: communityId,
        recovery_code: 'ZZZZ-ZZZZ',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('invalid');
    expect(body.remaining_attempts).toBeGreaterThanOrEqual(0);
  });

  it('returns 429 with retry-after header when the rate limit blocks the attempt', async () => {
    const authAbuseStore = new InMemoryAuthAbuseStore();
    const userStore = new InMemoryUserStore();
    const anchorUserId = '33333333-3333-4333-8333-333333333333';
    authAbuseStore.recoveryCodeDecisions.set(anchorUserId, {
      allowed: false,
      retryAfterSeconds: 120,
      remaining: 0,
    });

    const { app, accessToken, communityId } = await setupAnchorSession({
      authAbuseStore,
      userStore,
      recoveryCode: 'ABCD-1111',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anchor/session/recovery',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        community_id: communityId,
        recovery_code: 'ABCD-1111',
      },
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('120');
    const body = response.json();
    expect(body.remaining_attempts).toBe(0);
    expect(body.message).toContain('120s');
    expect(authAbuseStore.seenRecoveryKeys).toContain(anchorUserId);
  });

  it('returns 404 with remaining_attempts when the user is not an anchor of that community', async () => {
    const userStore = new InMemoryUserStore();
    const { app, accessToken } = await setupAnchorSession({
      userStore,
      recoveryCode: 'ABCD-1111',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anchor/session/recovery',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        community_id: '55555555-5555-4555-8555-555555555555',
        recovery_code: 'ABCD-1111',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.message).toContain('Anchor account not found');
    expect(body.remaining_attempts).toBeGreaterThanOrEqual(0);
  });

  it('counts every recovery attempt against the per-user rate limit', async () => {
    const authAbuseStore = new InMemoryAuthAbuseStore();
    const userStore = new InMemoryUserStore();
    const { app, accessToken, communityId, anchorUser } = await setupAnchorSession({
      authAbuseStore,
      userStore,
      recoveryCode: 'ABCD-1111',
    });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/anchor/session/recovery',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        community_id: communityId,
        recovery_code: 'WRONG-CODE',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/anchor/session/recovery',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        community_id: communityId,
        recovery_code: 'ABCD-1111',
      },
    });

    expect(
      authAbuseStore.seenRecoveryKeys.filter((entry) => entry === anchorUser.userId).length,
    ).toBeGreaterThanOrEqual(2);
  });
});

// ────────────────────────────────────────────────────────────────
// A4 P0-2 — anchor invite activate rate-limit regression
// ────────────────────────────────────────────────────────────────

describe('POST /v1/auth/anchor/activate rate limit (A4 P0-2)', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('returns 429 when the per-user bucket is exhausted before looking up the invite', async () => {
    const authAbuseStore = new InMemoryAuthAbuseStore();
    const userStore = new InMemoryUserStore();
    const verifiedUserId = '22222222-2222-4222-8222-222222222222';
    authAbuseStore.anchorActivateDecisions.set(verifiedUserId, {
      allowed: false,
      retryAfterSeconds: 42,
      remaining: 0,
    });

    userStore.users.set(
      verifiedUserId,
      createUserRecord({
        userId: verifiedUserId,
        level: 'verified',
        communityIds: [],
      }),
    );

    const { app } = await createTestApp({ authAbuseStore, userStore });
    apps.push(app);

    const accessToken = app.jwt.sign(
      {
        sub: verifiedUserId,
        level: 'verified',
        role: 'user',
        community_ids: [],
      },
      {
        algorithm: 'RS256',
        iss: app.config.jwt.issuer,
        expiresIn: app.config.jwt.accessTokenTtl,
      },
    );

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anchor/activate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { invite_code: 'WEAVE-ANCHOR-GRINDER' },
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('42');
    expect(authAbuseStore.seenAnchorActivateKeys).toContain(verifiedUserId);
  });
});

// ────────────────────────────────────────────────────────────────
// A1 P1-7 — server-side logout endpoint
// ────────────────────────────────────────────────────────────────

describe('POST /v1/auth/logout (A1 P1-7)', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('revokes every refresh-token family for the caller and returns 204', async () => {
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({ refreshTokenStore });
    apps.push(app);

    const anonResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/anonymous',
      payload: { device_id: randomUUID() },
    });
    const anon = anonResponse.json();

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${anon.access_token}` },
      payload: { revoke_all_devices: false },
    });

    expect(logoutResponse.statusCode).toBe(204);

    // The stored refresh-token family must now be revoked — any future
    // /v1/auth/refresh call with that token must fail.
    const stored = refreshTokenStore.sessions.get(anon.refresh_token);
    expect(stored).toBeDefined();
    expect(refreshTokenStore.revokedFamilies.has(stored!.familyId)).toBe(true);

    const refreshAttempt = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refresh_token: anon.refresh_token },
    });
    expect(refreshAttempt.statusCode).toBe(401);
  });

  it('rejects unauthenticated calls with 401', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: {},
    });
    expect(response.statusCode).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────
// A4 P0-3 — requireFreshAnchorMfa regressions
// ────────────────────────────────────────────────────────────────

describe('requireFreshAnchorMfa preHandler (A4 P0-3)', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];
  const communityId = '44444444-4444-4444-8444-444444444444';

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('returns 401 mfa_step_up_required when the JWT claim is older than the 15-minute step-up window', async () => {
    // Regression: `app.authenticate` previously trusted the JWT's
    // `mfa_verified_at` claim wholesale. A stolen access token could
    // carry an old claim (up to the 4h anchor idle window!) and keep
    // issuing destructive writes. Now every destructive route runs
    // `requireFreshAnchorMfa`, which demands a claim no older than 15m
    // AND cross-references the DB `anchors.last_mfa_at`.
    const userStore = new InMemoryUserStore();
    const staleMfaAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const anchorUser = createUserRecord({
      userId: '33333333-3333-4333-8333-333333333333',
      level: 'anchor',
      role: 'anchor',
      communityIds: [communityId],
      anchorCommunityId: communityId,
      mfaVerifiedAt: staleMfaAt,
    });
    userStore.users.set(anchorUser.userId, anchorUser);
    userStore.anchors.set(communityId, {
      anchorId: randomUUID(),
      userId: anchorUser.userId,
      communityId,
      orgName: 'Test Anchor',
      status: 'active',
      totpSecretCiphertext: null,
      recoveryCodesHashes: [],
      activatedAt: staleMfaAt,
      lastMfaAt: staleMfaAt,
    });

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const staleAccessToken = app.jwt.sign(
      {
        sub: anchorUser.userId,
        level: 'anchor',
        role: 'anchor',
        community_ids: [communityId],
        anchor_community_id: communityId,
        mfa_verified_at: staleMfaAt,
      },
      {
        algorithm: 'RS256',
        iss: app.config.jwt.issuer,
        expiresIn: app.config.jwt.accessTokenTtl,
      },
    );

    // Hit a destructive anchor route. Any one of:
    //   POST /v1/admin/review_queue/:post_id/decision
    //   POST /v1/admin/report_queue/:report_id/decision
    //   POST /v1/admin/communities/:id/announcements
    //   PUT  /v1/admin/communities/:id/rules
    // should reject on stale MFA. We use review_queue decision — the
    // POST needs only a post_id param which the preHandler rejects
    // before ever reading the body.
    const response = await app.inject({
      method: 'POST',
      url: `/v1/admin/review_queue/${randomUUID()}/decision`,
      headers: { authorization: `Bearer ${staleAccessToken}` },
      payload: { decision: 'approve' },
    });

    expect(response.statusCode).toBe(401);
    // Body shape matches the rest of the gateway's error responses:
    // `{ message: 'mfa_step_up_required' }` — downstream clients
    // (PWA / anchor-admin) branch on this message to trigger a TOTP
    // step-up modal and retry the call.
    expect(response.json()).toEqual({ message: 'mfa_step_up_required' });
  });
});
