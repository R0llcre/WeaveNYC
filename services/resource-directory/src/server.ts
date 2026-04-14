import { buildResourceDirectoryApp } from "./app.js";

async function main() {
  const app = await buildResourceDirectoryApp();
  const address = await app.listen({
    host: app.config.server.host,
    port: app.config.server.port,
  });

  console.info(`resource-directory-service listening on ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
