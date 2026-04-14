import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildNotificationsApp } from '../src/app.js';
import { loadNotificationsConfig } from '../src/config.js';
import { mintInternalServiceToken } from '../src/lib/internal-jwt.js';
import { ResendMagicLinkProvider, TwilioOtpProvider } from '../src/lib/providers.js';

const apps: Array<{ close: () => Promise<unknown> }> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('@weavenyc/notifications runtime', () => {
  it('defaults to stub providers in development and requires internal JWTs', async () => {
    const app = await buildNotificationsApp({
      config: {
        env: 'development',
        logLevel: 'info',
        server: {
          host: '127.0.0.1',
          port: 0,
        },
        internalJwt: {
          issuer: 'weavenyc-api-gateway:internal',
          secret: 'dev-secret',
        },
        providerMode: 'stub',
        demoBaseUrl: 'http://localhost:3000',
      },
    });
    apps.push(app);

    const token = mintInternalServiceToken(app);

    const smsResponse = await app.inject({
      method: 'POST',
      url: '/internal/notifications/send-otp',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        phone: '+15165550101',
        code: '123456',
        challenge_id: randomUUID(),
      },
    });

    expect(smsResponse.statusCode).toBe(200);
    const smsBody = smsResponse.json();
    expect(smsBody.provider).toBe('stub');
    expect(smsBody.fallback).toBe(true);
    expect(smsBody.demo_code).toBe('123456');

    const emailResponse = await app.inject({
      method: 'POST',
      url: '/internal/notifications/send-magic-link',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        email: 'neighbor@example.com',
        challenge_id: randomUUID(),
        token: 'ml_demo_token',
      },
    });

    expect(emailResponse.statusCode).toBe(200);
    const emailBody = emailResponse.json();
    expect(emailBody.provider).toBe('stub');
    expect(emailBody.fallback).toBe(true);
    expect(emailBody.demo_token).toBe('ml_demo_token');
    expect(emailBody.demo_url).toContain('/verify?challenge_id=');

    const unauthorizedResponse = await app.inject({
      method: 'POST',
      url: '/internal/notifications/send-otp',
      payload: {
        phone: '+15165550101',
        code: '123456',
        challenge_id: randomUUID(),
      },
    });

    expect(unauthorizedResponse.statusCode).toBe(401);
  });

  it('forms Twilio and Resend requests with the expected HTTP payloads', async () => {
    const smsFetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(String(input)).toContain('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
      expect(init?.headers).toMatchObject({
        Authorization: expect.stringMatching(/^Basic /),
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      const body = String(init?.body ?? '');
      expect(body).toContain('To=%2B15165550101');
      expect(body).toContain('Body=Your+WeaveNYC+verification+code+is+123456');
      expect(body).toContain('MessagingServiceSid=MG123');

      return new Response(JSON.stringify({ sid: 'SM123' }), {
        status: 201,
        headers: {
          'content-type': 'application/json',
        },
      });
    });

    const smsProvider = new TwilioOtpProvider({
      accountSid: 'AC123',
      authToken: 'secret',
      messagingServiceSid: 'MG123',
      fetchImpl: smsFetch as unknown as typeof fetch,
    });

    const smsChallengeId = randomUUID();
    const smsResult = await smsProvider.sendOtp({
      phone: '+15165550101',
      challenge_id: smsChallengeId,
      code: '123456',
    });

    expect(smsResult).toEqual({
      provider: 'twilio',
      fallback: false,
    });

    const emailFetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(String(input)).toBe('https://api.resend.com/emails');
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer re_123',
        'Content-Type': 'application/json',
      });

      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      expect(body.from).toBe('WeaveNYC <noreply@weavenyc.org>');
      expect(body.to).toBe('neighbor@example.com');
      expect(body.subject).toBe('WeaveNYC verification');

      return new Response(JSON.stringify({ id: 'email_123' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    });

    const emailProvider = new ResendMagicLinkProvider({
      apiKey: 're_123',
      fromEmail: 'WeaveNYC <noreply@weavenyc.org>',
      demoBaseUrl: 'http://localhost:3000',
      fetchImpl: emailFetch as unknown as typeof fetch,
    });

    const emailChallengeId = randomUUID();
    const emailToken = 'ml_demo_token';
    const emailResult = await emailProvider.sendMagicLink({
      email: 'neighbor@example.com',
      challenge_id: emailChallengeId,
      token: emailToken,
    });

    expect(emailResult.provider).toBe('resend');
    expect(emailResult.fallback).toBe(false);
  });

  it('fails fast when production config is missing provider credentials', async () => {
    await expect(
      loadNotificationsConfig({
        NODE_ENV: 'production',
        NOTIFICATIONS_INTERNAL_JWT_SECRET: 'prod-secret',
      }),
    ).rejects.toThrow('Missing required Twilio credentials');
  });

  it('fails fast when real mode is missing a Twilio sender identity', async () => {
    await expect(
      loadNotificationsConfig({
        NODE_ENV: 'production',
        NOTIFICATIONS_INTERNAL_JWT_SECRET: 'prod-secret',
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'secret',
        RESEND_API_KEY: 're_123',
        RESEND_FROM_EMAIL: 'noreply@example.com',
      }),
    ).rejects.toThrow('Missing required Twilio sender configuration');
  });

  it('fails fast when production real mode is missing a callback base URL', async () => {
    await expect(
      loadNotificationsConfig({
        NODE_ENV: 'production',
        NOTIFICATIONS_INTERNAL_JWT_SECRET: 'prod-secret',
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'secret',
        TWILIO_MESSAGING_SERVICE_SID: 'MG123',
        RESEND_API_KEY: 're_123',
        RESEND_FROM_EMAIL: 'noreply@example.com',
      }),
    ).rejects.toThrow('Missing required notifications callback base URL');
  });
});
