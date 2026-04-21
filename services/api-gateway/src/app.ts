import fastifyMultipart from '@fastify/multipart';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { DefaultChatService, PgChatRepository, type ChatService } from '@weavenyc/chat';
import { createMatchService, createPgMatchRepository, type MatchService } from '@weavenyc/match';
import { createPostsRepository, createPostsService, type PostsService } from '@weavenyc/posts';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';

import { loadConfig, type AppConfig } from './config.js';
import {
  createPgAnalyticsRecorder,
  InMemoryAnalyticsRecorder,
  type AnalyticsRecorder,
} from './lib/analytics.js';
import { InMemoryChatRealtimeHub, RedisChatRealtimeHub, type ChatRealtimeHub } from './lib/chat-realtime.js';
import {
  createRedisAuthAbuseStore,
  type AuthAbuseStore
} from './lib/identity.js';
import {
  InMemoryIdempotencyStore,
  PgIdempotencyStore,
  type IdempotencyStore,
} from './lib/idempotency.js';
import { createWeaveMetrics, normalizeRouteLabel, type WeaveMetrics } from './lib/metrics.js';
import { attachFastifySentry, initSentryNode } from './lib/sentry.js';
import {
  createPgResourceDirectoryService,
  type ResourceDirectoryService
} from './lib/resource-directory.js';
import {
  createHttpChatService,
  createHttpMatchService,
  createHttpPostsService,
  createHttpResourceDirectoryService
} from './lib/http-domain-services.js';
import { createPurgeJob, type PurgeJob } from './lib/purge-job.js';
import { createRedisRefreshTokenStore, type RefreshTokenStore } from './lib/refresh-token-store.js';
import { createStubSpeechProvider, type SpeechProvider } from './lib/speech-providers.js';
import {
  InMemoryP2PSyncRuntime,
  RedisP2PSyncRuntime,
  type P2PSyncRuntime,
} from './lib/sync-runtime.js';
import { runWithRequestContext } from './lib/request-context.js';
import { createPgUserStore, type UserStore } from './lib/user-store.js';
import { accountRoutes } from './routes/account.js';
import { analyticsRoutes } from './routes/analytics.js';
import { authRoutes } from './routes/auth.js';
import { adminCommunityRoutes } from './routes/admin-community.js';
import { communityAccessRoutes } from './routes/community-access.js';
import { healthRoutes } from './routes/health.js';
import { matchRoutes } from './routes/match.js';
import { meRoutes } from './routes/me.js';
import { postRoutes } from './routes/posts.js';
import { reviewQueueRoutes } from './routes/review-queue.js';
import { reportQueueRoutes } from './routes/report-queue.js';
import { resourceRoutes } from './routes/resources.js';
import { speechRoutes } from './routes/speech.js';
import { contactRequestRoutes } from './routes/contact-requests.js';
import { chatSafetyRoutes } from './routes/chat-safety.js';
import { chatSocketRoutes } from './routes/chat-socket.js';
import { conversationRoutes } from './routes/conversations.js';
import { p2pSyncRoutes } from './routes/p2p-sync.js';

export interface BuildAppOptions {
  analyticsRecorder?: AnalyticsRecorder;
  authAbuseStore?: AuthAbuseStore;
  chatRealtimeHub?: ChatRealtimeHub;
  chatService?: ChatService;
  config?: AppConfig;
  idempotencyStore?: IdempotencyStore;
  matchService?: MatchService;
  metrics?: WeaveMetrics;
  postsService?: PostsService;
  purgeJob?: PurgeJob;
  refreshTokenStore?: RefreshTokenStore;
  resourceDirectory?: ResourceDirectoryService;
  speechProvider?: SpeechProvider;
  syncRuntime?: P2PSyncRuntime;
  userStore?: UserStore;
  logger?: boolean;
}

function deriveAnchorSyncNodeId(config: AppConfig) {
  return createHash('sha256')
    .update(`${config.jwt.issuer}:${config.server.host}:${config.server.port}:${config.redisUrl}`)
    .digest('hex')
    .slice(0, 16);
}

function compileCorsOriginMatcher(pattern: string): (origin: string) => boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return (origin) => regex.test(origin);
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? (await loadConfig());

  // Sentry must be initialised before the Fastify app so that any early
  // require-time errors are captured. When the DSN is empty the bootstrap
  // returns a no-op shell and `attachFastifySentry` is a no-op too.
  const sentry = initSentryNode({
    dsn: config.sentry.dsn,
    environment: config.env,
    release: config.runtime.version,
    serviceName: config.runtime.serviceName,
    tracesSampleRate: config.sentry.tracesSampleRate,
  });

  const app = Fastify({
    logger: options.logger ?? false
  });

  const metrics = options.metrics ?? createWeaveMetrics();

  const userStore = options.userStore ?? createPgUserStore(config.databaseUrl);
  const refreshTokenStore =
    options.refreshTokenStore ??
    createRedisRefreshTokenStore(config.redisUrl, config.refreshTokenTtlSeconds);
  const authAbuseStore =
    options.authAbuseStore ?? createRedisAuthAbuseStore(config.redisUrl, config.identityHashPepper);
  const chatRealtimeHub =
    options.chatRealtimeHub ??
    (config.env === 'test' ? new InMemoryChatRealtimeHub() : new RedisChatRealtimeHub(config.redisUrl));
  const speechProvider = options.speechProvider ?? createStubSpeechProvider();
  const syncRuntime =
    options.syncRuntime ??
    (config.env === 'test'
      ? new InMemoryP2PSyncRuntime({
          nodeId: deriveAnchorSyncNodeId(config),
          mdnsDemoEnabled: config.p2pMdnsDemoEnabled,
        })
      : new RedisP2PSyncRuntime(config.redisUrl, config.databaseUrl, {
          nodeId: deriveAnchorSyncNodeId(config),
          mdnsDemoEnabled: config.p2pMdnsDemoEnabled,
        }));

  const corsOriginMatchers = config.corsAllowedOrigins.map(compileCorsOriginMatcher);
  await app.register(fastifyCors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowed = corsOriginMatchers.some((matcher) => matcher(origin));
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
  await app.register(fastifyWebsocket);

  // Rate-limiting is registered globally with a `global: false` default so
  // individual routes explicitly opt in via `config.rateLimit`. This keeps
  // the limiter surgical (only /bootstrap and /sync today) and avoids
  // accidentally throttling chat routes or anchor-admin flows.
  await app.register(fastifyRateLimit, {
    global: false,
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

  await app.register(fastifyJwt, {
    namespace: 'serviceJwt',
    secret: config.internalServiceJwtSecret,
    sign: {
      algorithm: 'HS256',
      iss: `${config.jwt.issuer}:internal`,
      expiresIn: '5m',
    },
    verify: {
      algorithms: ['HS256'],
      allowedIss: `${config.jwt.issuer}:internal`,
    },
  });

  const internalClientContext = {
    config,
    serviceJwt: app.serviceJwt
  };
  const resourceDirectory =
    options.resourceDirectory ??
    (config.internalServices.resourceDirectoryServiceUrl
      ? createHttpResourceDirectoryService(internalClientContext)
      : createPgResourceDirectoryService(config.databaseUrl));
  const matchService =
    options.matchService ??
    (config.internalServices.matchServiceUrl
      ? createHttpMatchService(internalClientContext)
      : createMatchService(
          createPgMatchRepository(config.databaseUrl, async (zip: string) => {
            const result = await resourceDirectory.searchResources({
              zip,
              limit: 50
            });
            return result.items;
          })
        ));
  const chatService =
    options.chatService ??
    (config.internalServices.chatServiceUrl
      ? createHttpChatService(internalClientContext)
      : new DefaultChatService(new PgChatRepository(new Pool({ connectionString: config.databaseUrl }))));
  const postsService =
    options.postsService ??
    (config.internalServices.postsServiceUrl
      ? createHttpPostsService(internalClientContext)
      : createPostsService(createPostsRepository(config.databaseUrl)));

  let idempotencyStorePool: Pool | null = null;
  const idempotencyStore: IdempotencyStore =
    options.idempotencyStore ??
    (config.env === 'test'
      ? new InMemoryIdempotencyStore()
      : (() => {
          idempotencyStorePool = new Pool({ connectionString: config.databaseUrl });
          return new PgIdempotencyStore(idempotencyStorePool);
        })());

  let purgeJobPool: Pool | null = null;
  const purgeJob =
    options.purgeJob ??
    (() => {
      purgeJobPool = new Pool({ connectionString: config.databaseUrl });
      return createPurgeJob({
        pool: purgeJobPool,
        enabled: config.purgeJob.enabled,
        schedule: config.purgeJob.schedule,
        actorHashPepper: config.identityHashPepper,
        logger: app.log,
      });
    })();

  let analyticsRecorderPool: Pool | null = null;
  const analyticsRecorder: AnalyticsRecorder =
    options.analyticsRecorder ??
    (config.env === 'test'
      ? new InMemoryAnalyticsRecorder({ hashPepper: config.identityHashPepper })
      : (() => {
          analyticsRecorderPool = new Pool({ connectionString: config.databaseUrl });
          return createPgAnalyticsRecorder(
            analyticsRecorderPool,
            config.identityHashPepper,
            app.log,
          );
        })());

  app.decorate('analyticsRecorder', analyticsRecorder);
  app.decorate('config', config);
  app.decorate('idempotencyStore', idempotencyStore);
  app.decorate('metrics', metrics);
  app.decorate('userStore', userStore);
  app.decorate('refreshTokenStore', refreshTokenStore);
  app.decorate('authAbuseStore', authAbuseStore);
  app.decorate('chatRealtimeHub', chatRealtimeHub);
  app.decorate('chatService', chatService);
  app.decorate('matchService', matchService);
  app.decorate('postsService', postsService);
  app.decorate('purgeJob', purgeJob);
  app.decorate('resourceDirectory', resourceDirectory);
  app.decorate('speechProvider', speechProvider);
  app.decorate('syncRuntime', syncRuntime);

  // Now that the logger + metrics decorators are in place, give the
  // P2P runtime structured logging + Prometheus counters. Done here (not
  // in the constructor) so the same runtime instance is also usable
  // standalone from tests that don't build a full Fastify app.
  syncRuntime.bindObservability({
    logger: app.log,
    metrics,
  });

  attachFastifySentry(app, sentry);

  // HTTP instrumentation: track request timing and count by method / route /
  // status. We sample `process.hrtime.bigint()` at the earliest available
  // hook (`onRequest`) so the histogram captures the full server-side
  // processing window. Prometheus scrapes this via `/metrics`.
  app.addHook('onRequest', async (request) => {
    request.metricsStartTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request, reply) => {
    if (request.metricsStartTime === undefined) {
      return;
    }

    const endedAt = process.hrtime.bigint();
    const durationSeconds = Number(endedAt - request.metricsStartTime) / 1_000_000_000;
    const route = normalizeRouteLabel(request.routeOptions.url, request.url);
    const method = request.method;
    const statusCode = String(reply.statusCode);

    metrics.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    metrics.httpRequestDurationSeconds.observe({ method, route }, durationSeconds);
  });

  app.decorate('authenticate', async (request) => {
    await request.jwtVerify();
    const currentUser = await app.userStore.getAuthUserById(request.user.sub);
    if (!currentUser) {
      const error = new Error('User not found') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    if (currentUser.status !== 'active') {
      const error = new Error('User account is not active') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

    request.currentUser = {
      ...currentUser,
      mfaVerifiedAt: request.user.mfa_verified_at,
    };
  });

  app.addHook('onRequest', (request, _reply, done) => {
    runWithRequestContext({ requestId: request.id }, done);
  });

  app.addHook('onListen', async () => {
    purgeJob.start();
  });

  app.addHook('onClose', async () => {
    const maybeCloseSpeechProvider = app.speechProvider.close ? app.speechProvider.close() : Promise.resolve();
    await Promise.all([
      app.userStore.close(),
      app.refreshTokenStore.close(),
      authAbuseStore.close(),
      app.chatRealtimeHub.close(),
      app.chatService.close(),
      app.idempotencyStore.close(),
      app.matchService.close(),
      app.postsService.close(),
      app.purgeJob.stop(),
      app.resourceDirectory.close(),
      app.syncRuntime.close(),
      app.analyticsRecorder.close(),
      maybeCloseSpeechProvider
    ]);
    if (idempotencyStorePool) {
      await idempotencyStorePool.end().catch(() => undefined);
    }
    if (purgeJobPool) {
      await purgeJobPool.end();
    }
    if (analyticsRecorderPool) {
      await analyticsRecorderPool.end().catch(() => undefined);
    }
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(accountRoutes);
  await app.register(adminCommunityRoutes);
  await app.register(communityAccessRoutes);
  await app.register(matchRoutes);
  await app.register(meRoutes);
  await app.register(postRoutes);
  await app.register(chatSocketRoutes);
  await app.register(contactRequestRoutes);
  await app.register(conversationRoutes);
  await app.register(chatSafetyRoutes);
  await app.register(reviewQueueRoutes);
  await app.register(reportQueueRoutes);
  await app.register(p2pSyncRoutes);
  await app.register(resourceRoutes);
  await app.register(speechRoutes);
  await app.register(analyticsRoutes);

  return app;
}
