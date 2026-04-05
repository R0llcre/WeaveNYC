import type { FastifyPluginAsync } from 'fastify';

import {
  anonymousAuthRequestSchema,
  anonymousAuthResponseSchema
} from '../contracts.js';
import { createOpaqueRefreshToken, signAccessToken } from '../lib/tokens.js';

type AnonymousAuthBody = {
  device_id: string;
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: AnonymousAuthBody }>(
    '/v1/auth/anonymous',
    {
      schema: {
        summary: 'Create an anonymous authenticated session',
        tags: ['auth'],
        body: anonymousAuthRequestSchema,
        response: {
          200: anonymousAuthResponseSchema
        }
      }
    },
    async (request) => {
      const user = await app.userStore.createAnonymousUser(request.body.device_id);
      const refreshToken = createOpaqueRefreshToken();

      await app.refreshTokenStore.store(refreshToken, {
        userId: user.userId,
        level: user.level,
        role: user.role,
        communityIds: user.communityIds
      });

      return {
        access_token: signAccessToken(app, user),
        refresh_token: refreshToken,
        user: {
          user_id: user.userId,
          level: user.level
        }
      };
    }
  );
};
