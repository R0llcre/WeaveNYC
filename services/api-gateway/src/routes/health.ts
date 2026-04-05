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
      const checks = {
        postgres: true,
        redis: true
      };

      const [postgresResult, redisResult] = await Promise.allSettled([
        app.userStore.ping(),
        app.refreshTokenStore.ping()
      ]);

      if (postgresResult.status === 'rejected') {
        checks.postgres = false;
      }

      if (redisResult.status === 'rejected') {
        checks.redis = false;
      }

      const ready = checks.postgres && checks.redis;
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
