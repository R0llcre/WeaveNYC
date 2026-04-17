import Fastify, { type FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';

import { createMagicLinkProvider, createOtpProvider } from './lib/providers.js';
import { attachFastifySentry, initSentryNode } from './lib/sentry.js';
import { loadNotificationsConfig } from './config.js';
import { notificationsRoutes } from './routes/notifications.js';
import type { BuildNotificationsAppOptions, NotificationsConfig } from './types.js';

export interface NotificationsApp extends FastifyInstance {
  config: NotificationsConfig;
}

export async function buildNotificationsApp(options: BuildNotificationsAppOptions = {}) {
  const config = options.config ?? (await loadNotificationsConfig());
  const sentry = initSentryNode({
    dsn: config.sentry.dsn,
    environment: config.env,
    release: config.runtime.version,
    serviceName: config.runtime.serviceName,
    tracesSampleRate: config.sentry.tracesSampleRate,
  });
  const app = Fastify({
    logger: options.logger ?? false,
  }) as unknown as NotificationsApp;
  attachFastifySentry(app, sentry);

  const otpProvider =
    options.otpProvider ??
    createOtpProvider(
      {
        providerMode: config.providerMode,
        demoBaseUrl: config.demoBaseUrl,
        twilio: config.twilio,
      },
    );
  const magicLinkProvider =
    options.magicLinkProvider ??
    createMagicLinkProvider(
      {
        providerMode: config.providerMode,
        demoBaseUrl: config.demoBaseUrl,
        resend: config.resend,
      },
    );

  app.decorate('config', config);

  await app.register(fastifyJwt, {
    secret: config.internalJwt.secret,
    sign: {
      algorithm: 'HS256',
      iss: config.internalJwt.issuer,
    },
    verify: {
      allowedIss: config.internalJwt.issuer,
    },
  });

  app.decorate('otpProvider', otpProvider);
  app.decorate('magicLinkProvider', magicLinkProvider);

  await app.register(notificationsRoutes, {
    otpProvider,
    magicLinkProvider,
  });

  app.get('/readyz', async () => ({
    status: 'ok',
    service: 'notifications-service',
    timestamp: new Date().toISOString(),
  }));

  app.get('/versionz', async () => ({
    service: 'notifications-service',
    version: process.env.npm_package_version ?? '0.1.0',
    runtime: process.version,
    timestamp: new Date().toISOString(),
  }));

  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', 'text/plain; charset=utf-8');
    return [
      '# HELP weavenyc_runtime_up Runtime process availability.',
      '# TYPE weavenyc_runtime_up gauge',
      `weavenyc_runtime_up{service="notifications-service",version="${process.env.npm_package_version ?? '0.1.0'}"} 1`,
      '# HELP weavenyc_runtime_uptime_seconds Runtime uptime in seconds.',
      '# TYPE weavenyc_runtime_uptime_seconds gauge',
      `weavenyc_runtime_uptime_seconds{service="notifications-service"} ${process.uptime().toFixed(3)}`,
      '',
    ].join('\n');
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof Error && 'statusCode' in error) {
      const statusCode = Number((error as Error & { statusCode?: number }).statusCode ?? 500);
      reply.code(statusCode >= 400 ? statusCode : 500);
      return reply.send({ message: error.message });
    }

    void request;
    reply.code(500);
    return reply.send({ message: 'Internal server error' });
  });

  return app;
}
