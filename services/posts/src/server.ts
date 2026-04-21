import { buildPostsApp } from "./app.js";

async function main() {
  // Pino redact + request serializer — keep Bearer JWTs, cookies, and
  // query-string tokens out of the logs. See api-gateway/src/server.ts
  // for the rationale; we mirror the same redact policy on every
  // service that writes logs.
  const app = await buildPostsApp({
    logger: {
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.query.token",
          "*.phone",
          "*.email",
          "*.address_line_1",
          "*.address_line_2",
          "*.password",
          "*.otp",
          "*.code",
        ],
        censor: "[REDACTED]",
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
          const rawUrl = typeof request.url === "string" ? request.url : "";
          return {
            id: request.id,
            method: request.method,
            url: rawUrl.split("?")[0],
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

  console.info(`posts-service listening on ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
