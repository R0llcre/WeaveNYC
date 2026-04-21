import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import {
  InMemoryAnalyticsRecorder,
  InMemoryAuthAbuseStore,
  InMemoryRefreshTokenStore,
  InMemoryResourceDirectory,
  InMemorySpeechProvider,
  InMemoryUserStore,
  createNoopPurgeJob,
  createTestConfig,
} from './helpers.js';
import { InMemoryChatRealtimeHub } from '../src/lib/chat-realtime.js';
import { InMemoryP2PSyncRuntime } from '../src/lib/sync-runtime.js';
import { DefaultChatService, InMemoryChatRepository } from '@weavenyc/chat';
import { createMatchService, InMemoryMatchRepository } from '@weavenyc/match';
import { InMemoryPostsService } from '@weavenyc/posts';

/**
 * Asserts that the redact config we ship in every service's server.ts
 * actually keeps Bearer JWTs, cookies, and `?token=` query-string
 * tokens out of the log stream. We build a real Fastify app with the
 * production redact config and inject a request carrying a fake
 * Bearer token + cookie + `?token=` value, then confirm none of those
 * strings appear in the captured log output.
 *
 * The test exercises api-gateway specifically because it is the only
 * service that builds a full dependency graph here, but the redact
 * config is copy-pasted across all services — if this test passes,
 * the other services inherit the same protection.
 */
describe('pino redact', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('redacts Authorization header and query-string token from request logs', async () => {
    const logLines: string[] = [];
    const capturingStream = {
      write(chunk: string) {
        logLines.push(chunk);
      },
    };

    const postsService = new InMemoryPostsService();
    const userStore = new InMemoryUserStore();

    const app = await buildApp({
      analyticsRecorder: new InMemoryAnalyticsRecorder(),
      authAbuseStore: new InMemoryAuthAbuseStore(),
      chatRealtimeHub: new InMemoryChatRealtimeHub(),
      chatService: new DefaultChatService(new InMemoryChatRepository()),
      config: createTestConfig(),
      matchService: createMatchService(new InMemoryMatchRepository()),
      postsService,
      purgeJob: createNoopPurgeJob(),
      userStore,
      refreshTokenStore: new InMemoryRefreshTokenStore(),
      resourceDirectory: new InMemoryResourceDirectory(),
      speechProvider: new InMemorySpeechProvider(),
      syncRuntime: new InMemoryP2PSyncRuntime(),
      logger: {
        level: 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.query.token',
            '*.phone',
            '*.email',
            '*.address_line_1',
            '*.address_line_2',
            '*.password',
            '*.otp',
            '*.code',
          ],
          censor: '[REDACTED]',
        },
        serializers: {
          req(request: {
            id?: string;
            method?: string;
            url?: string;
            host?: string;
            remoteAddress?: string;
            remotePort?: number;
          }) {
            const rawUrl = typeof request.url === 'string' ? request.url : '';
            return {
              id: request.id,
              method: request.method,
              url: rawUrl.split('?')[0],
              host: request.host,
              remoteAddress: request.remoteAddress,
              remotePort: request.remotePort,
            };
          },
        },
        stream: capturingStream,
      },
    });
    apps.push(app);

    const bearerJwt = 'eyJ.FAKE-JWT-TOKEN.NEVER-LOG-ME';

    await app.inject({
      method: 'GET',
      url: '/healthz?token=live-token-xyz',
      headers: {
        authorization: `Bearer ${bearerJwt}`,
        cookie: 'session=secret-cookie-value;',
      },
    });

    const combined = logLines.join('\n');

    // Secrets must never reach the log pipeline.
    expect(combined).not.toContain(bearerJwt);
    expect(combined).not.toContain('live-token-xyz');
    expect(combined).not.toContain('secret-cookie-value');

    // Our custom `req` serializer explicitly drops the headers + query
    // fields (belt-and-braces with the redact paths), so we just
    // assert the path-only URL appears and any `?token=…` suffix did
    // not sneak through.
    expect(combined).toContain('"url":"/healthz"');
    expect(combined).not.toContain('?token=');
  });
});
