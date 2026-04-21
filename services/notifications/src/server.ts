import { buildNotificationsApp } from './app.js';

async function main() {
  // Pino redact + request serializer — mirror api-gateway policy:
  // keep Bearer JWTs, cookies, and query-string tokens out of the log
  // stream plus defensive PII redactions. Notifications handles
  // phone/email payloads so the PII redactions are especially
  // load-bearing here.
  const app = await buildNotificationsApp({
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
  const address = await app.listen({
    host: app.config.server.host,
    port: app.config.server.port,
  });

  console.info(`notifications-service listening on ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
