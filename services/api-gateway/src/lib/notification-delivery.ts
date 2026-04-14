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
      const response = await requestInternalJson<NotificationOtpSendResponse>(app, 'notifications', {
        path: '/internal/notifications/send-otp',
        method: 'POST',
        body: {
          phone: input.phone,
          code: input.code,
          challenge_id: input.challengeId
        }
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
      const response = await requestInternalJson<NotificationMagicLinkSendResponse>(app, 'notifications', {
        path: '/internal/notifications/send-magic-link',
        method: 'POST',
        body: {
          email: input.email,
          challenge_id: input.challengeId,
          token: input.token
        }
      });

      return {
        fallback: response.fallback,
        demoToken: response.demo_token,
        demoUrl: response.demo_url
      };
    }
  };
}
