import type {
  NotificationMagicLinkSendRequest,
  NotificationMagicLinkSendResponse,
  NotificationOtpSendRequest,
  NotificationOtpSendResponse,
} from '@weavenyc/shared';

import { NotificationsServiceError } from '../types.js';

type FetchLike = typeof fetch;

function buildDemoUrl(baseUrl: string, challengeId: string, token: string) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const url = new URL(`${normalizedBase}/verify`);
  url.searchParams.set('challenge_id', challengeId);
  url.searchParams.set('token', token);
  return url.toString();
}

async function readResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export class StubOtpProvider {
  async sendOtp(input: NotificationOtpSendRequest): Promise<NotificationOtpSendResponse> {
    console.info('[notifications-stub-otp]', {
      phone: input.phone,
      challengeId: input.challenge_id,
      code: input.code,
    });

    return {
      provider: 'stub',
      fallback: true,
      demo_code: input.code,
    };
  }
}

export class StubMagicLinkProvider {
  constructor(private readonly baseUrl: string) {}

  async sendMagicLink(input: NotificationMagicLinkSendRequest): Promise<NotificationMagicLinkSendResponse> {
    const demoUrl = buildDemoUrl(this.baseUrl, input.challenge_id, input.token);

    console.info('[notifications-stub-magic-link]', {
      email: input.email,
      challengeId: input.challenge_id,
      token: input.token,
      demoUrl,
    });

    return {
      provider: 'stub',
      fallback: true,
      demo_token: input.token,
      demo_url: demoUrl,
    };
  }
}

export class TwilioOtpProvider {
  constructor(
    private readonly input: {
      accountSid: string;
      authToken: string;
      messagingServiceSid?: string;
      fromNumber?: string;
      fetchImpl?: FetchLike;
    },
  ) {}

  async sendOtp(input: NotificationOtpSendRequest): Promise<NotificationOtpSendResponse> {
    const fetchImpl = this.input.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.input.accountSid}/Messages.json`;
    const form = new URLSearchParams({
      To: input.phone,
      Body: `Your WeaveNYC verification code is ${input.code}`,
    });

    if (this.input.messagingServiceSid) {
      form.set('MessagingServiceSid', this.input.messagingServiceSid);
    } else if (this.input.fromNumber) {
      form.set('From', this.input.fromNumber);
    } else {
      throw new NotificationsServiceError(
        'Twilio sender configuration is missing',
        'provider_unavailable',
        503,
      );
    }

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.input.accountSid}:${this.input.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const detail = await readResponseText(response);
      throw new NotificationsServiceError(
        `Twilio OTP send failed: ${response.status} ${detail}`.trim(),
        'provider_unavailable',
        502,
      );
    }

    const payload = (await response.json()) as { sid?: string };
    if (!payload.sid) {
      throw new NotificationsServiceError('Twilio response missing sid', 'provider_unavailable', 502);
    }

    return {
      provider: 'twilio',
      fallback: false,
    };
  }
}

export class ResendMagicLinkProvider {
  constructor(
    private readonly input: {
      apiKey: string;
      fromEmail: string;
      demoBaseUrl: string;
      fetchImpl?: FetchLike;
    },
  ) {}

  async sendMagicLink(input: NotificationMagicLinkSendRequest): Promise<NotificationMagicLinkSendResponse> {
    const fetchImpl = this.input.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const demoUrl = buildDemoUrl(this.input.demoBaseUrl, input.challenge_id, input.token);

    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.input.fromEmail,
        to: input.email,
        subject: 'WeaveNYC verification',
        text: `Use this link to continue: ${demoUrl}`,
      }),
    });

    if (!response.ok) {
      const detail = await readResponseText(response);
      throw new NotificationsServiceError(
        `Resend magic-link send failed: ${response.status} ${detail}`.trim(),
        'provider_unavailable',
        502,
      );
    }

    const payload = (await response.json()) as { id?: string };
    if (!payload.id) {
      throw new NotificationsServiceError('Resend response missing id', 'provider_unavailable', 502);
    }

    return {
      provider: 'resend',
      fallback: false,
    };
  }
}

export function createOtpProvider(
  config: { providerMode: 'stub' | 'real'; demoBaseUrl: string; twilio?: { accountSid: string; authToken: string; messagingServiceSid?: string; fromNumber?: string } },
  fetchImpl?: FetchLike,
) {
  if (config.providerMode === 'stub') {
    return new StubOtpProvider();
  }

  if (!config.twilio) {
    throw new NotificationsServiceError('Twilio configuration is missing', 'provider_unavailable', 503);
  }

  return new TwilioOtpProvider({
    ...config.twilio,
    fetchImpl,
  });
}

export function createMagicLinkProvider(
  config: { providerMode: 'stub' | 'real'; demoBaseUrl: string; resend?: { apiKey: string; fromEmail: string } },
  fetchImpl?: FetchLike,
) {
  if (config.providerMode === 'stub') {
    return new StubMagicLinkProvider(config.demoBaseUrl);
  }

  if (!config.resend) {
    throw new NotificationsServiceError('Resend configuration is missing', 'provider_unavailable', 503);
  }

  return new ResendMagicLinkProvider({
    ...config.resend,
    demoBaseUrl: config.demoBaseUrl,
    fetchImpl,
  });
}
