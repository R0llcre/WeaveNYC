import type { FastifyPluginAsync } from 'fastify';

import {
  notificationMagicLinkSendRequestSchema,
  notificationMagicLinkSendResponseSchema,
  notificationOtpSendRequestSchema,
  notificationOtpSendResponseSchema,
} from '@weavenyc/shared';

import type { MagicLinkNotificationProvider, OtpNotificationProvider } from '../types.js';
import { authenticateInternalService, internalServiceClaimsSchema } from '../lib/internal-jwt.js';
import { NotificationsServiceError } from '../types.js';

type RoutePluginOptions = {
  otpProvider: OtpNotificationProvider;
  magicLinkProvider: MagicLinkNotificationProvider;
};

function invalidBody(message: string) {
  return new NotificationsServiceError(message, 'invalid_input', 400);
}

function assertInternalScope(value: unknown) {
  const parsed = internalServiceClaimsSchema.safeParse(value);
  if (!parsed.success) {
    throw new NotificationsServiceError('Invalid internal service token', 'forbidden', 403);
  }

  return parsed.data;
}

async function authorizeInternal(request: Parameters<typeof authenticateInternalService>[0], reply: Parameters<typeof authenticateInternalService>[1]) {
  const claims = await authenticateInternalService(request, reply);
  if (reply.sent) {
    return null;
  }

  return assertInternalScope(claims);
}

export const notificationsRoutes: FastifyPluginAsync<RoutePluginOptions> = async (app, options) => {
  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'notifications-service',
    timestamp: new Date().toISOString(),
  }));

  app.post('/internal/notifications/send-otp', async (request, reply) => {
    const auth = await authorizeInternal(request, reply);
    if (!auth) {
      return;
    }

    const parsedBody = notificationOtpSendRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw invalidBody('Invalid OTP notification payload');
    }

    try {
      const result = await options.otpProvider.sendOtp(parsedBody.data);
      const parsedResult = notificationOtpSendResponseSchema.safeParse(result);
      if (!parsedResult.success) {
        throw new NotificationsServiceError('OTP provider returned an invalid response', 'provider_unavailable', 502);
      }

      return parsedResult.data;
    } catch (error) {
      if (error instanceof NotificationsServiceError) {
        reply.code(error.statusCode);
        return { message: error.message };
      }

      reply.code(502);
      return { message: 'OTP provider is unavailable' };
    }
  });

  app.post('/internal/notifications/send-magic-link', async (request, reply) => {
    const auth = await authorizeInternal(request, reply);
    if (!auth) {
      return;
    }

    const parsedBody = notificationMagicLinkSendRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw invalidBody('Invalid magic-link notification payload');
    }

    try {
      const result = await options.magicLinkProvider.sendMagicLink(parsedBody.data);
      const parsedResult = notificationMagicLinkSendResponseSchema.safeParse(result);
      if (!parsedResult.success) {
        throw new NotificationsServiceError('Magic-link provider returned an invalid response', 'provider_unavailable', 502);
      }

      return parsedResult.data;
    } catch (error) {
      if (error instanceof NotificationsServiceError) {
        reply.code(error.statusCode);
        return { message: error.message };
      }

      reply.code(502);
      return { message: 'Magic-link provider is unavailable' };
    }
  });
};
