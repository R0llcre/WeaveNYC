import 'fastify';

import type { AuthTokenClaims } from './types.js';
import type { AppConfig } from './config.js';
import type { AuthAbuseStore } from './lib/identity.js';
import type { RefreshTokenStore } from './lib/refresh-token-store.js';
import type { ResourceDirectoryService } from './lib/resource-directory.js';
import type { UserStore } from './lib/user-store.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    authAbuseStore: AuthAbuseStore;
    refreshTokenStore: RefreshTokenStore;
    resourceDirectory: ResourceDirectoryService;
    userStore: UserStore;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthTokenClaims;
  }
}
