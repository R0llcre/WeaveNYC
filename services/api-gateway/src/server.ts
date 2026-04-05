import { buildApp } from './app.js';

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
