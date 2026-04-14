import type {
  NotificationMagicLinkSendRequest,
  NotificationMagicLinkSendResponse,
  NotificationOtpSendRequest,
  NotificationOtpSendResponse,
} from '@weavenyc/shared';

export type NotificationsProviderMode = 'stub' | 'real';

export type NotificationsConfig = {
  env: 'development' | 'test' | 'production';
  logLevel: string;
  server: {
    host: string;
    port: number;
  };
  internalJwt: {
    issuer: string;
    secret: string;
  };
  providerMode: NotificationsProviderMode;
  demoBaseUrl: string;
  twilio?: {
    accountSid: string;
    authToken: string;
    messagingServiceSid?: string;
    fromNumber?: string;
  };
  resend?: {
    apiKey: string;
    fromEmail: string;
  };
};

export type InternalServiceClaims = {
  sub: string;
  scope: 'internal_service';
  aud: 'notifications-service';
  iss: string;
  request_id?: string;
  actor?: {
    sub: string;
    level: 'anonymous' | 'verified' | 'anchor';
    role: 'user' | 'anchor';
    community_ids: string[];
    anchor_community_id?: string;
    mfa_verified_at?: string;
    status?: 'active' | 'suspended' | 'deleted';
  };
  iat?: number;
  exp?: number;
};

export type OtpNotificationProvider = {
  sendOtp(input: NotificationOtpSendRequest): Promise<NotificationOtpSendResponse>;
};

export type MagicLinkNotificationProvider = {
  sendMagicLink(input: NotificationMagicLinkSendRequest): Promise<NotificationMagicLinkSendResponse>;
};

export type BuildNotificationsAppOptions = {
  config?: NotificationsConfig;
  otpProvider?: OtpNotificationProvider;
  magicLinkProvider?: MagicLinkNotificationProvider;
  logger?: boolean;
};

export class NotificationsServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid_input'
      | 'unauthorized'
      | 'forbidden'
      | 'provider_unavailable'
      | 'not_found',
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'NotificationsServiceError';
  }
}
