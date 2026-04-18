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
  const app = await buildApp({ logger: true });

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
