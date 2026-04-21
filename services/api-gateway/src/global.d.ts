import 'fastify';

import type { AuthTokenClaims, InternalServiceTokenClaims } from './types.js';
import type { AppConfig } from './config.js';
import type { AuthenticatedUserRecord } from './types.js';
import type { ChatService } from '@weavenyc/chat';
import type { AnalyticsRecorder } from './lib/analytics.js';
import type { AuthAbuseStore } from './lib/identity.js';
import type { ChatRealtimeHub } from './lib/chat-realtime.js';
import type { IdempotencyStore } from './lib/idempotency.js';
import type { WeaveMetrics } from './lib/metrics.js';
import type { PurgeJob } from './lib/purge-job.js';
import type { RefreshTokenStore } from './lib/refresh-token-store.js';
import type { ResourceDirectoryService } from './lib/resource-directory.js';
import type { SpeechProvider } from './lib/speech-providers.js';
import type { P2PSyncRuntime } from './lib/sync-runtime.js';
import type { UserStore } from './lib/user-store.js';
import type { MatchService } from '@weavenyc/match';
import type { PostsService } from '@weavenyc/posts';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: AuthenticatedUserRecord;
    metricsStartTime?: bigint;
  }

  interface FastifyInstance {
    config: AppConfig;
    analyticsRecorder: AnalyticsRecorder;
    authAbuseStore: AuthAbuseStore;
    chatRealtimeHub: ChatRealtimeHub;
    chatService: ChatService;
    idempotencyStore: IdempotencyStore;
    matchService: MatchService;
    metrics: WeaveMetrics;
    postsService: PostsService;
    purgeJob: PurgeJob;
    refreshTokenStore: RefreshTokenStore;
    resourceDirectory: ResourceDirectoryService;
    speechProvider: SpeechProvider;
    syncRuntime: P2PSyncRuntime;
    userStore: UserStore;
    authenticate: (request: FastifyRequest) => Promise<void>;
    serviceJwt: {
      sign: (payload: InternalServiceTokenClaims) => string;
      verify: <T extends object = InternalServiceTokenClaims>(token: string) => Promise<T>;
    };
    // P0-3 test hooks: the chat-socket plugin exposes these so tests can
    // drive the stale-socket sweeper deterministically (instead of
    // waiting 30s on a real setInterval). They are no-ops in production
    // paths — nothing outside of tests calls them. The optional `now`
    // arg overrides the sweeper's clock for that single invocation so
    // tests can jump past the 90s stale threshold without stalling
    // wall time.
    chatSocketSweepForTest: (now?: number) => void;
    chatSocketLiveCountForTest: () => number;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthTokenClaims;
  }

  interface FastifyJWTNamespace {
    serviceJwt: {
      payload: InternalServiceTokenClaims;
      user: InternalServiceTokenClaims;
    };
  }
}
