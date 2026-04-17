import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createTestApp,
  InMemoryAuthAbuseStore,
  InMemoryRefreshTokenStore,
  InMemoryUserStore,
} from './helpers.js';
import type { AnalyticsRecorder } from '../src/lib/analytics.js';
import { InMemoryAnalyticsRecorder } from '../src/lib/analytics.js';

type SessionResponse = {
  access_token: string;
  refresh_token: string;
  user: {
    user_id: string;
    level: string;
  };
};

type DeleteRequestResponse = {
  challenge_id: string;
  masked_destination: string;
  delivery_channel: 'sms' | 'email';
  expires_in_seconds: number;
  fallback?: boolean;
  demo_code?: string;
  demo_token?: string;
};

type DeleteConfirmResponse = {
  status: 'deletion_scheduled';
  purge_date: string;
  user_id: string;
  undelete_recovery_token: string;
};

type UndeleteConfirmResponse = {
  status: 'restored';
  user_id: string;
};

async function bootstrapVerifiedUser(app: Awaited<ReturnType<typeof createTestApp>>['app']) {
  const anon = await app.inject({
    method: 'POST',
    url: '/v1/auth/anonymous',
    payload: { device_id: randomUUID() },
  });
  const anonBody = anon.json() as SessionResponse;

  const otpStart = await app.inject({
    method: 'POST',
    url: '/v1/auth/otp/start',
    headers: { authorization: `Bearer ${anonBody.access_token}` },
    payload: { phone: '+15165550123' },
  });
  const otpStartBody = otpStart.json() as {
    challenge_id: string;
    demo_code?: string;
  };

  const otpVerify = await app.inject({
    method: 'POST',
    url: '/v1/auth/otp/verify',
    headers: { authorization: `Bearer ${anonBody.access_token}` },
    payload: {
      challenge_id: otpStartBody.challenge_id,
      code: otpStartBody.demo_code,
    },
  });
  return otpVerify.json() as SessionResponse;
}

describe('account deletion three-step flow', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('happy path: request, confirm with correct code, marks user deleted and returns recovery token', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const analyticsRecorder = new InMemoryAnalyticsRecorder();
    const { app } = await createTestApp({
      userStore,
      refreshTokenStore,
      analyticsRecorder,
    });
    apps.push(app);

    const session = await bootstrapVerifiedUser(app);

    const request = await app.inject({
      method: 'POST',
      url: '/v1/account/delete/request',
      headers: { authorization: `Bearer ${session.access_token}` },
      payload: {},
    });
    expect(request.statusCode).toBe(200);
    const challenge = request.json() as DeleteRequestResponse;
    expect(challenge.challenge_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(challenge.delivery_channel).toBe('sms');
    expect(challenge.demo_code).toBeDefined();

    const confirm = await app.inject({
      method: 'POST',
      url: '/v1/account/delete/confirm',
      headers: { authorization: `Bearer ${session.access_token}` },
      payload: {
        challenge_id: challenge.challenge_id,
        code: challenge.demo_code,
        reason: 'privacy_concerns',
      },
    });
    expect(confirm.statusCode).toBe(202);
    const confirmBody = confirm.json() as DeleteConfirmResponse;
    expect(confirmBody.status).toBe('deletion_scheduled');
    expect(confirmBody.user_id).toBe(session.user.user_id);
    const purgeAt = new Date(confirmBody.purge_date).getTime();
    const now = Date.now();
    // purge_at should be ~30 days out
    expect(purgeAt).toBeGreaterThan(now + 29 * 24 * 60 * 60 * 1000);
    expect(purgeAt).toBeLessThan(now + 31 * 24 * 60 * 60 * 1000);
    expect(confirmBody.undelete_recovery_token).toMatch(/^uri_/);

    const storedUser = userStore.users.get(session.user.user_id);
    expect(storedUser?.status).toBe('deleted');
    expect(userStore.phoneIdentities.has(session.user.user_id)).toBe(false);

    const analyticsEvents = (analyticsRecorder as InMemoryAnalyticsRecorder).events;
    expect(analyticsEvents.some((event) => event.event_type === 'account_deleted')).toBe(true);
  });

  it('returns 400 and decrements remaining attempts on wrong code', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({ userStore, refreshTokenStore });
    apps.push(app);

    const session = await bootstrapVerifiedUser(app);
    const requestResp = (
      await app.inject({
        method: 'POST',
        url: '/v1/account/delete/request',
        headers: { authorization: `Bearer ${session.access_token}` },
        payload: {},
      })
    ).json() as DeleteRequestResponse;

    // 5 wrong attempts -> 400 (invalid) x4, then exhausted on the 5th
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const resp = await app.inject({
        method: 'POST',
        url: '/v1/account/delete/confirm',
        headers: { authorization: `Bearer ${session.access_token}` },
        payload: {
          challenge_id: requestResp.challenge_id,
          code: '000000',
        },
      });
      expect(resp.statusCode).toBe(400);
    }

    // Challenge consumed: a further attempt with correct code should now be
    // rejected as invalid/missing.
    const after = await app.inject({
      method: 'POST',
      url: '/v1/account/delete/confirm',
      headers: { authorization: `Bearer ${session.access_token}` },
      payload: {
        challenge_id: requestResp.challenge_id,
        code: requestResp.demo_code,
      },
    });
    expect(after.statusCode).toBe(400);
  });

  it('returns 409 cannot_verify_identity when user has no phone/email bound', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({ userStore, refreshTokenStore });
    apps.push(app);

    const anon = await app.inject({
      method: 'POST',
      url: '/v1/auth/anonymous',
      payload: { device_id: randomUUID() },
    });
    const anonBody = anon.json() as SessionResponse;

    // Anonymous users cannot pass the preHandler `authenticate` check? They can —
    // level is anonymous but status=active so the middleware allows them through.
    const resp = await app.inject({
      method: 'POST',
      url: '/v1/account/delete/request',
      headers: { authorization: `Bearer ${anonBody.access_token}` },
      payload: {},
    });
    expect(resp.statusCode).toBe(409);
    expect(resp.json().message).toContain('cannot_verify_identity');
  });

  it('rate limits account-delete requests after the hourly burst', async () => {
    const authAbuseStore = new InMemoryAuthAbuseStore();
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({
      authAbuseStore,
      userStore,
      refreshTokenStore,
    });
    apps.push(app);

    const session = await bootstrapVerifiedUser(app);

    // First 3 should succeed (burst = 3), 4th should 429
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const resp = await app.inject({
        method: 'POST',
        url: '/v1/account/delete/request',
        headers: { authorization: `Bearer ${session.access_token}` },
        payload: {},
      });
      expect(resp.statusCode).toBe(200);
    }

    const fourth = await app.inject({
      method: 'POST',
      url: '/v1/account/delete/request',
      headers: { authorization: `Bearer ${session.access_token}` },
      payload: {},
    });
    expect(fourth.statusCode).toBe(429);
    expect(fourth.headers['retry-after']).toBeDefined();
  });

  it('blocks deletion when the user is the only active anchor in a community', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({ userStore, refreshTokenStore });
    apps.push(app);

    const session = await bootstrapVerifiedUser(app);
    const communityId = randomUUID();
    // Seed a solo anchor record for this user
    userStore.anchors.set(communityId, {
      anchorId: randomUUID(),
      userId: session.user.user_id,
      communityId,
      orgName: 'Test Anchor',
      status: 'active',
      totpSecretCiphertext: null,
      recoveryCodesHashes: [],
      activatedAt: new Date().toISOString(),
      lastMfaAt: new Date().toISOString(),
    });

    const request = (
      await app.inject({
        method: 'POST',
        url: '/v1/account/delete/request',
        headers: { authorization: `Bearer ${session.access_token}` },
        payload: {},
      })
    ).json() as DeleteRequestResponse;

    const confirm = await app.inject({
      method: 'POST',
      url: '/v1/account/delete/confirm',
      headers: { authorization: `Bearer ${session.access_token}` },
      payload: {
        challenge_id: request.challenge_id,
        code: request.demo_code,
        reason: 'moving_away',
      },
    });
    expect(confirm.statusCode).toBe(409);
    expect(confirm.json().message).toContain('last_anchor_blocks_delete');

    // User should still be active
    expect(userStore.users.get(session.user.user_id)?.status).toBe('active');
  });

  it('allows deletion when another anchor exists in the same community', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({ userStore, refreshTokenStore });
    apps.push(app);

    const session = await bootstrapVerifiedUser(app);
    const communityId = randomUUID();
    const otherAnchorId = randomUUID();
    const otherUserId = randomUUID();

    userStore.anchors.set(communityId, {
      anchorId: randomUUID(),
      userId: session.user.user_id,
      communityId,
      orgName: 'Test Anchor',
      status: 'active',
      totpSecretCiphertext: null,
      recoveryCodesHashes: [],
      activatedAt: new Date().toISOString(),
      lastMfaAt: new Date().toISOString(),
    });
    // Add a second anchor in the same community (keyed by a second synthetic id)
    userStore.anchors.set(`${communityId}-second`, {
      anchorId: otherAnchorId,
      userId: otherUserId,
      communityId,
      orgName: 'Backup Anchor',
      status: 'active',
      totpSecretCiphertext: null,
      recoveryCodesHashes: [],
      activatedAt: new Date().toISOString(),
      lastMfaAt: new Date().toISOString(),
    });

    const request = (
      await app.inject({
        method: 'POST',
        url: '/v1/account/delete/request',
        headers: { authorization: `Bearer ${session.access_token}` },
        payload: {},
      })
    ).json() as DeleteRequestResponse;

    const confirm = await app.inject({
      method: 'POST',
      url: '/v1/account/delete/confirm',
      headers: { authorization: `Bearer ${session.access_token}` },
      payload: {
        challenge_id: request.challenge_id,
        code: request.demo_code,
      },
    });
    expect(confirm.statusCode).toBe(202);
    // The user's anchor row should be revoked, the other's preserved
    expect(userStore.anchors.get(communityId)?.status).toBe('revoked');
    expect(userStore.anchors.get(`${communityId}-second`)?.status).toBe('active');
  });
});

describe('account undelete flow', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('happy path: delete → undelete with recovery token restores user to active', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const analyticsRecorder = new InMemoryAnalyticsRecorder() as AnalyticsRecorder;
    const { app } = await createTestApp({
      userStore,
      refreshTokenStore,
      analyticsRecorder,
    });
    apps.push(app);

    const session = await bootstrapVerifiedUser(app);

    const deleteRequest = (
      await app.inject({
        method: 'POST',
        url: '/v1/account/delete/request',
        headers: { authorization: `Bearer ${session.access_token}` },
        payload: {},
      })
    ).json() as DeleteRequestResponse;

    const deleteConfirm = (
      await app.inject({
        method: 'POST',
        url: '/v1/account/delete/confirm',
        headers: { authorization: `Bearer ${session.access_token}` },
        payload: {
          challenge_id: deleteRequest.challenge_id,
          code: deleteRequest.demo_code,
        },
      })
    ).json() as DeleteConfirmResponse;

    const undeleteRequest = await app.inject({
      method: 'POST',
      url: '/v1/account/undelete/request',
      payload: { user_id: session.user.user_id },
    });
    expect(undeleteRequest.statusCode).toBe(200);

    const undeleteConfirm = await app.inject({
      method: 'POST',
      url: '/v1/account/undelete',
      payload: {
        user_id: session.user.user_id,
        recovery_token: deleteConfirm.undelete_recovery_token,
      },
    });
    expect(undeleteConfirm.statusCode).toBe(200);
    const restored = undeleteConfirm.json() as UndeleteConfirmResponse;
    expect(restored.status).toBe('restored');
    expect(restored.user_id).toBe(session.user.user_id);

    const userRow = userStore.users.get(session.user.user_id);
    expect(userRow?.status).toBe('active');
    // PII was nulled during delete and is NOT re-populated on undelete
    expect(userStore.phoneIdentities.has(session.user.user_id)).toBe(false);
    // A second undelete with the same token fails
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/account/undelete',
      payload: {
        user_id: session.user.user_id,
        recovery_token: deleteConfirm.undelete_recovery_token,
      },
    });
    expect([400, 409]).toContain(replay.statusCode);
  });

  it('returns 410 gone when purge_at is in the past', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({ userStore, refreshTokenStore });
    apps.push(app);

    const session = await bootstrapVerifiedUser(app);

    const deleteRequest = (
      await app.inject({
        method: 'POST',
        url: '/v1/account/delete/request',
        headers: { authorization: `Bearer ${session.access_token}` },
        payload: {},
      })
    ).json() as DeleteRequestResponse;
    const deleteConfirm = (
      await app.inject({
        method: 'POST',
        url: '/v1/account/delete/confirm',
        headers: { authorization: `Bearer ${session.access_token}` },
        payload: {
          challenge_id: deleteRequest.challenge_id,
          code: deleteRequest.demo_code,
        },
      })
    ).json() as DeleteConfirmResponse;

    // Simulate that the purge window has elapsed.
    const record = userStore.deletionRecords.get(session.user.user_id);
    if (record) {
      record.purgeAt = new Date(Date.now() - 60_000).toISOString();
      userStore.deletionRecords.set(session.user.user_id, record);
    }

    const undeleteRequest = await app.inject({
      method: 'POST',
      url: '/v1/account/undelete/request',
      payload: { user_id: session.user.user_id },
    });
    expect(undeleteRequest.statusCode).toBe(410);

    const undeleteConfirm = await app.inject({
      method: 'POST',
      url: '/v1/account/undelete',
      payload: {
        user_id: session.user.user_id,
        recovery_token: deleteConfirm.undelete_recovery_token,
      },
    });
    expect(undeleteConfirm.statusCode).toBe(410);
  });

  it('returns 404 for undelete on a user that does not exist', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const bogus = randomUUID();
    const resp = await app.inject({
      method: 'POST',
      url: '/v1/account/undelete',
      payload: {
        user_id: bogus,
        recovery_token: 'uri_12345678_abcdefghijklmnopqrstuvwxyz',
      },
    });
    expect(resp.statusCode).toBe(404);
  });

  it('rejects undelete with an incorrect recovery token', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({ userStore, refreshTokenStore });
    apps.push(app);

    const session = await bootstrapVerifiedUser(app);
    const deleteRequest = (
      await app.inject({
        method: 'POST',
        url: '/v1/account/delete/request',
        headers: { authorization: `Bearer ${session.access_token}` },
        payload: {},
      })
    ).json() as DeleteRequestResponse;
    await app.inject({
      method: 'POST',
      url: '/v1/account/delete/confirm',
      headers: { authorization: `Bearer ${session.access_token}` },
      payload: {
        challenge_id: deleteRequest.challenge_id,
        code: deleteRequest.demo_code,
      },
    });

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/account/undelete',
      payload: {
        user_id: session.user.user_id,
        recovery_token: 'uri_00000000_deadbeefdeadbeefdeadbeefdeadbeef',
      },
    });
    expect(resp.statusCode).toBe(400);
  });
});
