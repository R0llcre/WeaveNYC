import type { FastifyPluginAsync } from 'fastify';

import { errorResponseSchema, meResponseSchema } from '../contracts.js';

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/v1/me',
    {
      schema: {
        summary: 'Read the authenticated session',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: meResponseSchema,
          404: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const user = await app.userStore.getAuthUserById(request.user.sub);

      if (!user) {
        reply.code(404);
        return {
          message: 'User not found'
        };
      }

      return {
        user: {
          user_id: user.userId,
          level: user.level,
          role: user.role,
          community_ids: user.communityIds
        }
      };
    }
  );
};
