import { createHmac, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyServerOptions } from "fastify";
import { Pool } from "pg";

import type { ResourceDirectoryConfig } from "./config.js";
import { loadResourceDirectoryConfig } from "./config.js";
import { NominatimGeocoder, type Geocoder } from "./lib/geocoding.js";
import { ResourceImportRepository, ResourceQueryRepository } from "./lib/repository.js";
import { attachFastifySentry, initSentryNode } from "./lib/sentry.js";
import type { ResourceListItem, ResourceSearchInput, ResourceSearchResult } from "./types.js";

type InternalServiceClaims = {
  iss: string;
  aud: string;
  scope: "internal_service";
  request_id: string;
  iat?: number;
  exp?: number;
};

declare module "fastify" {
  interface FastifyRequest {
    internalClaims?: InternalServiceClaims;
  }
}

type ResourceDirectoryService = {
  searchResources(input: ResourceSearchInput): Promise<ResourceSearchResult>;
  getResourceDetail(providerId: string, zip?: string): Promise<ResourceListItem | null>;
  close(): Promise<void>;
};

export interface ResourceDirectoryApp extends FastifyInstance {
  config: ResourceDirectoryConfig;
}

function buildMetricsText(input: { service: string; version: string; uptimeSeconds: number }) {
  return [
    "# HELP weavenyc_runtime_up Runtime process availability.",
    "# TYPE weavenyc_runtime_up gauge",
    `weavenyc_runtime_up{service="${input.service}",version="${input.version}"} 1`,
    "# HELP weavenyc_runtime_uptime_seconds Runtime uptime in seconds.",
    "# TYPE weavenyc_runtime_uptime_seconds gauge",
    `weavenyc_runtime_uptime_seconds{service="${input.service}"} ${input.uptimeSeconds.toFixed(3)}`,
    "# HELP weavenyc_runtime_memory_rss_bytes Resident set size in bytes.",
    "# TYPE weavenyc_runtime_memory_rss_bytes gauge",
    `weavenyc_runtime_memory_rss_bytes{service="${input.service}"} ${process.memoryUsage().rss}`,
    "",
  ].join("\n");
}

function base64UrlToUtf8(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function readBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization ?? "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}

function verifyInternalToken(token: string, expectedAudience: string, config: ResourceDirectoryConfig) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid service token");
  }

  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  const header = JSON.parse(base64UrlToUtf8(headerPart)) as { alg?: string };
  if (header.alg !== "HS256") {
    throw new Error("Invalid service token");
  }

  const expectedSignature = createHmac("sha256", config.internalJwt.secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest("base64url");
  const provided = Buffer.from(signaturePart);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Invalid service token");
  }

  const payload = JSON.parse(base64UrlToUtf8(payloadPart)) as InternalServiceClaims;
  if (
    payload.scope !== "internal_service" ||
    payload.aud !== expectedAudience ||
    payload.iss !== config.internalJwt.issuer
  ) {
    throw new Error("Invalid service token");
  }

  if (typeof payload.exp === "number" && Date.now() / 1000 >= payload.exp) {
    throw new Error("Service token expired");
  }

  return payload;
}

export async function buildResourceDirectoryApp(
  options: {
    config?: ResourceDirectoryConfig;
    logger?: FastifyServerOptions['logger'];
    geocoder?: Geocoder;
  } = {},
): Promise<ResourceDirectoryApp> {
  const config = options.config ?? loadResourceDirectoryConfig();
  const sentry = initSentryNode({
    dsn: config.sentry.dsn,
    environment: config.env,
    release: config.runtime.version,
    serviceName: config.runtime.serviceName,
    tracesSampleRate: config.sentry.tracesSampleRate,
  });
  const app = Fastify({
    logger: options.logger ?? false,
  }) as unknown as ResourceDirectoryApp;
  attachFastifySentry(app, sentry);
  const pool = new Pool({ connectionString: config.databaseUrl });
  const queryRepository = new ResourceQueryRepository(pool);
  const importRepository = new ResourceImportRepository(pool);
  // A5 P0.5 — the sidecar used to hard-code `{ lat: null, lng: null }`, which
  // collapsed the 10-mile radius filter to "zip string exact match" and caused
  // e.g. a Farmingdale (11735) user to never see a Bethpage (11714) pantry
  // 2 miles away. We now geocode the caller's ZIP the same way the monolith
  // path does (see services/api-gateway/src/lib/resource-directory.ts).
  const geocoder: Geocoder = options.geocoder ?? new NominatimGeocoder();
  const service: ResourceDirectoryService = {
    searchResources: async (input) => {
      const zipCenter = await geocoder.geocodeZip(input.zip);
      const result = await queryRepository.searchResources(input, zipCenter);
      // A5 P0 bonus — surface the "geocoder could not resolve this ZIP"
      // signal so the client can render an explicit empty state instead
      // of a silent empty list.
      if (zipCenter.lat === null || zipCenter.lng === null) {
        return { ...result, noResultsInArea: true };
      }
      return result;
    },
    getResourceDetail: async (providerId, zip) => {
      const zipCenter = zip ? await geocoder.geocodeZip(zip) : { lat: null, lng: null };
      return queryRepository.getResourceDetail(providerId, zipCenter);
    },
    close: async () => {
      await importRepository.close();
    },
  };
  const startedAt = new Date().toISOString();

  app.decorate("config", config);
  app.decorateRequest("internalClaims", undefined);

  app.setErrorHandler((error, _request, reply) => {
    reply.code(500);
    return reply.send({ message: error instanceof Error ? error.message : "Internal server error" });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404);
    return reply.send({ message: "Not found" });
  });

  app.get("/healthz", async () => ({
    status: "ok",
    service: config.runtime.serviceName,
    timestamp: new Date().toISOString(),
  }));

  app.get("/readyz", async (_request, reply) => {
    try {
      await queryRepository.searchResources({ zip: "11735", limit: 1 }, { lat: null, lng: null });
      return reply.code(200).send({
        status: "ok",
        service: config.runtime.serviceName,
        timestamp: new Date().toISOString(),
        checks: [
          {
            name: "postgres",
            status: "ok" as const,
          },
        ],
      });
    } catch (error) {
      return reply.code(503).send({
        status: "unavailable",
        service: config.runtime.serviceName,
        timestamp: new Date().toISOString(),
        checks: [
          {
            name: "postgres",
            status: "unavailable" as const,
            detail: error instanceof Error ? error.message : "database unavailable",
          },
        ],
      });
    }
  });

  app.get("/versionz", async () => ({
    status: "ok",
    service: config.runtime.serviceName,
    version: config.runtime.version,
    started_at: startedAt,
    node_version: process.version,
    pid: process.pid,
  }));

  app.get("/metrics", async (_request, reply) => {
    reply.type("text/plain; charset=utf-8");
    return buildMetricsText({
      service: config.runtime.serviceName,
      version: config.runtime.version,
      uptimeSeconds: process.uptime(),
    });
  });

  app.addHook("onClose", async () => {
    await service.close();
  });

  await app.register(async (internal) => {
    internal.addHook("onRequest", async (request, reply) => {
      const token = readBearerToken(request);
      if (!token) {
        reply.code(401);
        return reply.send({ message: "Missing internal service token" });
      }

      try {
        request.internalClaims = verifyInternalToken(token, config.runtime.serviceName, config);
      } catch (error) {
        reply.code(403);
        return reply.send({ message: error instanceof Error ? error.message : "Invalid service token" });
      }
    });

    internal.post<{ Body: ResourceSearchInput }>("/internal/v1/resource-directory/search-resources", async (request) =>
      service.searchResources({
        zip: request.body.zip,
        openNow: request.body.openNow,
        today: request.body.today,
        type: request.body.type,
        limit: request.body.limit,
        cursor: request.body.cursor ?? null,
      }),
    );

    internal.post<{ Body: { providerId: string; zip?: string } }>("/internal/v1/resource-directory/get-resource-detail", async (request) =>
      service.getResourceDetail(request.body.providerId, request.body.zip),
    );
  });

  return app;
}
