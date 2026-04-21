import { describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../src/config.js';
import { signInternalServiceToken } from '../src/lib/internal-service-client.js';

function createConfig(): AppConfig {
  return {
    env: 'test',
    logLevel: 'info',
    server: {
      host: '127.0.0.1',
      port: 4000
    },
    databaseUrl: 'postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev',
    redisUrl: 'redis://localhost:6379',
    pwaBaseUrl: 'http://localhost:3000',
    jwt: {
      issuer: 'weavenyc-api-gateway',
      accessTokenTtl: '15m',
      privateKeyPath: './infra/dev/jwt-private.pem',
      publicKeyPath: './infra/dev/jwt-public.pem',
      privateKey: 'PRIVATE',
      publicKey: 'PUBLIC'
    },
    refreshTokenTtlSeconds: 60 * 60 * 24 * 7,
    p2pMdnsDemoEnabled: false,
    corsAllowedOrigins: ['http://localhost:*', 'http://127.0.0.1:*'],
    identityHashPepper: 'weavenyc-dev-identity-pepper',
    anchorTotpEncryptionKey: 'weavenyc-dev-anchor-totp-encryption-key',
    internalServiceJwtSecret: 'weavenyc-dev-internal-service-jwt-secret',
    internalServices: {
      postsServiceUrl: null,
      matchServiceUrl: null,
      chatServiceUrl: null,
      resourceDirectoryServiceUrl: null,
      notificationsServiceUrl: null
    },
    purgeJob: {
      enabled: false,
      schedule: '0 0 * * *',
      retainAnalyticsDays: 180
    },
    sentry: {
      dsn: null,
      tracesSampleRate: 0.1
    },
    runtime: {
      serviceName: 'api-gateway',
      version: '0.1.0-test'
    }
  };
}

describe('signInternalServiceToken', () => {
  it('includes the runtime service name as the subject claim', () => {
    const sign = vi.fn(() => 'signed-token');

    const token = signInternalServiceToken(
      {
        config: createConfig(),
        serviceJwt: { sign }
      },
      'notifications'
    );

    expect(token).toBe('signed-token');
    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'api-gateway',
        aud: 'notifications-service',
        iss: 'weavenyc-api-gateway:internal',
        scope: 'internal_service'
      })
    );
  });
});
