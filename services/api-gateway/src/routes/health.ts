import type { FastifyPluginAsync } from 'fastify';

import { healthResponseSchema, readyzResponseSchema } from '../contracts.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/healthz',
    {
      schema: {
        summary: 'Process liveness probe',
        response: {
          200: healthResponseSchema
        }
      }
    },
    async () => ({
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString()
    })
  );

  app.get(
    '/readyz',
    {
      schema: {
        summary: 'Dependency readiness probe',
        response: {
          200: readyzResponseSchema,
          503: readyzResponseSchema
        }
      }
    },
    async (_request, reply) => {
      const [postgresResult, redisResult] = await Promise.allSettled([
        app.userStore.ping(),
        app.refreshTokenStore.ping()
      ]);

      const checks = [
        {
          name: 'postgres',
          status: postgresResult.status === 'fulfilled' ? 'ok' : 'degraded',
          detail:
            postgresResult.status === 'rejected'
              ? postgresResult.reason instanceof Error
                ? postgresResult.reason.message
                : 'postgres unavailable'
              : undefined
        },
        {
          name: 'redis',
          status: redisResult.status === 'fulfilled' ? 'ok' : 'degraded',
          detail:
            redisResult.status === 'rejected'
              ? redisResult.reason instanceof Error
                ? redisResult.reason.message
                : 'redis unavailable'
              : undefined
        }
      ];

      const ready = checks.every((check) => check.status === 'ok');
      reply.code(ready ? 200 : 503);

      return {
        status: ready ? 'ok' : 'degraded',
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
        checks
      };
    }
  );
};
