import { randomBytes } from "node:crypto";

export interface SmsDeliveryResult {
  fallback: boolean;
  demoCode?: string;
}

export interface EmailLinkDeliveryResult {
  fallback: boolean;
  demoToken?: string;
  demoUrl?: string;
}

export interface SmsProvider {
  sendOtp(input: {
    phone: string;
    code: string;
    challengeId: string;
  }): Promise<SmsDeliveryResult>;
}

export interface EmailLinkProvider {
  sendMagicLink(input: {
    email: string;
    challengeId: string;
    token: string;
  }): Promise<EmailLinkDeliveryResult>;
}

export class StubSmsProvider implements SmsProvider {
  async sendOtp(input: {
    phone: string;
    code: string;
    challengeId: string;
  }): Promise<SmsDeliveryResult> {
    console.info("[stub-sms]", {
      phone: input.phone,
      code: input.code,
      challengeId: input.challengeId
    });

    return {
      fallback: true,
      demoCode: input.code
    };
  }
}

export class StubEmailLinkProvider implements EmailLinkProvider {
  constructor(private readonly baseUrl: string) {}

  async sendMagicLink(input: {
    email: string;
    challengeId: string;
    token: string;
  }): Promise<EmailLinkDeliveryResult> {
    const demoUrl = `${this.baseUrl.replace(/\/$/, "")}/verify?challenge_id=${input.challengeId}&token=${input.token}`;

    console.info("[stub-email-link]", {
      email: input.email,
      challengeId: input.challengeId,
      token: input.token,
      demoUrl
    });

    return {
      fallback: true,
      demoToken: input.token,
      demoUrl
    };
  }
}

export function createMagicLinkToken() {
  return `ml_${randomBytes(24).toString("base64url")}`;
}
