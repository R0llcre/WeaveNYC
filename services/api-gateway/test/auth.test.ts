import { randomUUID } from 'node:crypto';

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
