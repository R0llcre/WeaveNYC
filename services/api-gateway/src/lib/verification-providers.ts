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

/**
 * OTP / magic-link sendOtp and sendMagicLink inputs are union types:
 *
 *   - `{ phone, code, challengeId }` — used by `/v1/auth/otp/start` where
 *     the caller supplies the phone number (new enrollment flow).
 *   - `{ userId, code, challengeId }` — used by the account-delete flow
 *     where the API gateway MUST NOT synthesize a raw phone placeholder
 *     (A1 P0-14). The notification service resolves `userId → phone` on
 *     its own side; the gateway only passes the user id through.
 *
 * Stub providers accept either shape and fall back to the demo code.
 */
export type SmsSendOtpInput =
  | { phone: string; code: string; challengeId: string }
  | { userId: string; code: string; challengeId: string };

export type EmailSendMagicLinkInput =
  | { email: string; challengeId: string; token: string }
  | { userId: string; challengeId: string; token: string };

export interface SmsProvider {
  sendOtp(input: SmsSendOtpInput): Promise<SmsDeliveryResult>;
}

export interface EmailLinkProvider {
  sendMagicLink(input: EmailSendMagicLinkInput): Promise<EmailLinkDeliveryResult>;
}

export class StubSmsProvider implements SmsProvider {
  async sendOtp(input: SmsSendOtpInput): Promise<SmsDeliveryResult> {
    const destination = 'phone' in input ? input.phone : `user:${input.userId}`;
    console.info("[stub-sms]", {
      destination,
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

  async sendMagicLink(input: EmailSendMagicLinkInput): Promise<EmailLinkDeliveryResult> {
    const demoUrl = `${this.baseUrl.replace(/\/$/, "")}/verify?challenge_id=${input.challengeId}&token=${input.token}`;
    const destination = 'email' in input ? input.email : `user:${input.userId}`;

    console.info("[stub-email-link]", {
      destination,
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
