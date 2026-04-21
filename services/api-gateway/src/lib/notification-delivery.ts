import type { FastifyInstance } from 'fastify';
import type {
  NotificationMagicLinkSendResponse,
  NotificationOtpSendResponse
} from '@weavenyc/shared';

import {
  StubEmailLinkProvider,
  StubSmsProvider,
  type EmailLinkProvider,
  type SmsProvider
} from './verification-providers.js';
import { requestInternalJson } from './internal-service-client.js';

export function createSmsVerificationProvider(app: FastifyInstance): SmsProvider {
  const stubProvider = new StubSmsProvider();
  if (!app.config.internalServices.notificationsServiceUrl) {
    return stubProvider;
  }

  return {
    async sendOtp(input) {
      // The notification service accepts either `phone` (new enrollment
      // flow) or `user_id` (account-delete re-auth flow — A1 P0-14).
      // When `user_id` is passed the service resolves the phone on its
      // own side, so the gateway never synthesizes a placeholder.
      const body =
        'phone' in input
          ? {
              phone: input.phone,
              code: input.code,
              challenge_id: input.challengeId
            }
          : {
              user_id: input.userId,
              code: input.code,
              challenge_id: input.challengeId
            };

      const response = await requestInternalJson<NotificationOtpSendResponse>(app, 'notifications', {
        path: '/internal/notifications/send-otp',
        method: 'POST',
        body
      });

      return {
        fallback: response.fallback,
        demoCode: response.demo_code
      };
    }
  };
}

export function createMagicLinkVerificationProvider(app: FastifyInstance): EmailLinkProvider {
  const stubProvider = new StubEmailLinkProvider(app.config.pwaBaseUrl);
  if (!app.config.internalServices.notificationsServiceUrl) {
    return stubProvider;
  }

  return {
    async sendMagicLink(input) {
      const body =
        'email' in input
          ? {
              email: input.email,
              challenge_id: input.challengeId,
              token: input.token
            }
          : {
              user_id: input.userId,
              challenge_id: input.challengeId,
              token: input.token
            };

      const response = await requestInternalJson<NotificationMagicLinkSendResponse>(app, 'notifications', {
        path: '/internal/notifications/send-magic-link',
        method: 'POST',
        body
      });

      return {
        fallback: response.fallback,
        demoToken: response.demo_token,
        demoUrl: response.demo_url
      };
    }
  };
}
