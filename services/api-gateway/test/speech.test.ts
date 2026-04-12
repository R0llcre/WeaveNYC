import { afterEach, describe, expect, it } from 'vitest';

import { createTestApp, createUserRecord, InMemoryUserStore } from './helpers.js';

function signUser(app: Awaited<ReturnType<typeof createTestApp>>['app'], user: ReturnType<typeof createUserRecord>) {
  return app.jwt.sign(
    {
      sub: user.userId,
      level: user.level,
      role: user.role,
      community_ids: user.communityIds,
      anchor_community_id: user.anchorCommunityId ?? undefined,
      mfa_verified_at: user.mfaVerifiedAt,
    },
    {
      algorithm: 'RS256',
      iss: app.config.jwt.issuer,
      expiresIn: app.config.jwt.accessTokenTtl,
    }
  );
}

function buildMultipartBody() {
  const boundary = '----weavenyc-test-boundary';
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="language"\r\n\r\n` +
    `en\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="transcript_hint"\r\n\r\n` +
    `Need help with groceries\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="audio"; filename="note.webm"\r\n` +
    `Content-Type: audio/webm\r\n\r\n` +
    `Need help with groceries\r\n` +
    `--${boundary}--\r\n`;

  return {
    boundary,
    body,
  };
}

describe('speech routes', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('transcribes a multipart upload through the stub provider', async () => {
    const userStore = new InMemoryUserStore();
    const user = createUserRecord();
    userStore.users.set(user.userId, user);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const token = signUser(app, user);
    const multipart = buildMultipartBody();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/speech/transcribe',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      transcript: 'Need help with groceries',
      language: 'en',
      provider: 'server_fallback',
    });
  });
});
