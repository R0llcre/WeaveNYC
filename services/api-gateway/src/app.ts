import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';

import { loadConfig, type AppConfig } from './config.js';
import {
  createRedisAuthAbuseStore,
  type AuthAbuseStore
} from './lib/identity.js';
import {
  createPgResourceDirectoryService,
  type ResourceDirectoryService
} from './lib/resource-directory.js';
import { createRedisRefreshTokenStore, type RefreshTokenStore } from './lib/refresh-token-store.js';
import { createPgUserStore, type UserStore } from './lib/user-store.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { resourceRoutes } from './routes/resources.js';

export interface BuildAppOptions {
  authAbuseStore?: AuthAbuseStore;
  config?: AppConfig;
  refreshTokenStore?: RefreshTokenStore;
  resourceDirectory?: ResourceDirectoryService;
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
  const authAbuseStore =
    options.authAbuseStore ?? createRedisAuthAbuseStore(config.redisUrl, config.identityHashPepper);
  const resourceDirectory =
    options.resourceDirectory ?? createPgResourceDirectoryService(config.databaseUrl);

  app.decorate('config', config);
  app.decorate('userStore', userStore);
  app.decorate('refreshTokenStore', refreshTokenStore);
  app.decorate('authAbuseStore', authAbuseStore);
  app.decorate('resourceDirectory', resourceDirectory);

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
    await Promise.all([
      app.userStore.close(),
      app.refreshTokenStore.close(),
      authAbuseStore.close(),
      app.resourceDirectory.close()
    ]);
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(resourceRoutes);

  return app;
}
