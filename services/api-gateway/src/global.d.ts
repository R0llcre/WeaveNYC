import 'fastify';

import type { AuthTokenClaims } from './types.js';
import type { AppConfig } from './config.js';
import type { AuthenticatedUserRecord } from './types.js';
import type { ChatService } from '@weavenyc/chat';
import type { AuthAbuseStore } from './lib/identity.js';
import type { ChatRealtimeHub } from './lib/chat-realtime.js';
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
  }

  interface FastifyInstance {
    config: AppConfig;
    authAbuseStore: AuthAbuseStore;
    chatRealtimeHub: ChatRealtimeHub;
    chatService: ChatService;
    matchService: MatchService;
    postsService: PostsService;
    refreshTokenStore: RefreshTokenStore;
    resourceDirectory: ResourceDirectoryService;
    speechProvider: SpeechProvider;
    syncRuntime: P2PSyncRuntime;
    userStore: UserStore;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthTokenClaims;
  }
}
