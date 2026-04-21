import { buildApp } from './app.js';

// Guard: keep the process alive when background infrastructure (e.g. Redis)
// is temporarily unreachable. Without this handler, ioredis's
// `MaxRetriesPerRequestError` is thrown as an uncaught exception and the
// Node process exits with code 1 — which causes App Runner / Cloud Run /
// Container Apps to enter a crashloop even though HTTP traffic is healthy.
// The underlying subsystem (refresh tokens, chat realtime, sync fanout)
// still surfaces the error per request via `/readyz`, so observability is
// preserved; we only suppress the top-level crash.
// These handlers run before buildApp() resolves, so the Fastify logger is not
// yet available; we write directly to stderr to preserve operator visibility
// without relying on `console` (which would require an eslint-disable once
// `no-console` is enabled for this package).
process.on('uncaughtException', (error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  process.stderr.write(
    `[api-gateway] uncaughtException (keeping process alive): ${err.message}\n`
  );
});
process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  process.stderr.write(
    `[api-gateway] unhandledRejection (keeping process alive): ${err.message}\n`
  );
});

async function start(): Promise<void> {
  // Pino redact + custom request serializer — keep Bearer JWTs, cookies,
  // and query-string tokens out of the logs. The default Fastify
  // serializer logs `req.headers.authorization` verbatim (would leak
  // every access JWT) and `req.url` with the full query string (would
  // leak `?token=` for chat/P2P WS upgrades). We pair the redact paths
  // with a `serializers.req` that strips everything after `?` from the
  // URL so operators still see the path but never the bearer token.
  // We also redact common PII field names (phone/email/address/password)
  // so app-level `req.log.info({ ... })` callsites can't accidentally
  // persist user identifiers.
  const app = await buildApp({
    logger: {
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
    },
  });

  try {
    await app.listen({
      host: app.config.server.host,
      port: app.config.server.port
    });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
    await app.close();
  }
}

void start();
