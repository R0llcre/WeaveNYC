import { buildNotificationsApp } from './app.js';

async function main() {
  const app = await buildNotificationsApp();
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
