import fastifyMultipart from '@fastify/multipart';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { createPostsRepository, createPostsService, type PostsService } from '@weavenyc/posts';

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
import { createStubSpeechProvider, type SpeechProvider } from './lib/speech-providers.js';
import { createPgUserStore, type UserStore } from './lib/user-store.js';
import { authRoutes } from './routes/auth.js';
import { communityAccessRoutes } from './routes/community-access.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { postRoutes } from './routes/posts.js';
import { reviewQueueRoutes } from './routes/review-queue.js';
import { resourceRoutes } from './routes/resources.js';
import { speechRoutes } from './routes/speech.js';

export interface BuildAppOptions {
  authAbuseStore?: AuthAbuseStore;
  config?: AppConfig;
  postsService?: PostsService;
  refreshTokenStore?: RefreshTokenStore;
  resourceDirectory?: ResourceDirectoryService;
  speechProvider?: SpeechProvider;
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
  const postsService =
    options.postsService ?? createPostsService(createPostsRepository(config.databaseUrl));
  const speechProvider = options.speechProvider ?? createStubSpeechProvider();

  app.decorate('config', config);
  app.decorate('userStore', userStore);
  app.decorate('refreshTokenStore', refreshTokenStore);
  app.decorate('authAbuseStore', authAbuseStore);
  app.decorate('postsService', postsService);
  app.decorate('resourceDirectory', resourceDirectory);
  app.decorate('speechProvider', speechProvider);

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

  await app.register(fastifyMultipart, {
    attachFieldsToBody: false,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1
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
    const maybeCloseSpeechProvider = app.speechProvider.close ? app.speechProvider.close() : Promise.resolve();
    await Promise.all([
      app.userStore.close(),
      app.refreshTokenStore.close(),
      authAbuseStore.close(),
      app.postsService.close(),
      app.resourceDirectory.close(),
      maybeCloseSpeechProvider
    ]);
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(communityAccessRoutes);
  await app.register(meRoutes);
  await app.register(postRoutes);
  await app.register(reviewQueueRoutes);
  await app.register(resourceRoutes);
  await app.register(speechRoutes);

  return app;
}
