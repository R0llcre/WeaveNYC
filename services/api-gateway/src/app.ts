import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';

import { loadConfig, type AppConfig } from './config.js';
import { createRedisRefreshTokenStore, type RefreshTokenStore } from './lib/refresh-token-store.js';
import { createPgUserStore, type UserStore } from './lib/user-store.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';

export interface BuildAppOptions {
  config?: AppConfig;
  refreshTokenStore?: RefreshTokenStore;
  userStore?: UserStore;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? (await loadConfig());
  const app = Fastify({
    logger: options.logger ?? false
  });

  const userStore = options.userStore ?? createPgUserStore(config.databaseUrl);
  const refreshTokenStore =
    options.refreshTokenStore ??
    createRedisRefreshTokenStore(config.redisUrl, config.refreshTokenTtlSeconds);

  app.decorate('config', config);
  app.decorate('userStore', userStore);
  app.decorate('refreshTokenStore', refreshTokenStore);

  await app.register(fastifyCors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowed = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
      callback(allowed ? null : new Error('Origin not allowed'), allowed);
    }
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'WeaveNYC API Gateway',
        version: '0.1.0'
      },
      servers: [
        {
          url: 'http://localhost:4000'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    }
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs'
  });

  await app.register(fastifyJwt, {
    secret: {
      private: config.jwt.privateKey,
      public: config.jwt.publicKey
    },
    sign: {
      algorithm: 'RS256',
      iss: config.jwt.issuer
    },
    verify: {
      algorithms: ['RS256'],
      allowedIss: config.jwt.issuer
    }
  });

  app.decorate('authenticate', async (request) => {
    await request.jwtVerify();
  });

  app.addHook('onClose', async () => {
    await Promise.all([app.userStore.close(), app.refreshTokenStore.close()]);
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);

  return app;
}
