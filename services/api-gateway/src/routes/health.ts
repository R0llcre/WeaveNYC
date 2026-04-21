import type { FastifyPluginAsync } from 'fastify';

import {
  healthResponseSchema,
  metricsResponseSchema,
  readyzResponseSchema,
  versionResponseSchema,
} from '../contracts.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/healthz',
    {
      schema: {
        summary: 'Process liveness probe',
        response: {
          200: healthResponseSchema
        }
      }
    },
    async () => ({
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString()
    })
  );

  app.get(
    '/readyz',
    {
      schema: {
        summary: 'Dependency readiness probe',
        response: {
          200: readyzResponseSchema,
          503: readyzResponseSchema
        }
      }
    },
    async (_request, reply) => {
      // Each probe is independent — use Promise.allSettled so one
      // wedged dependency doesn't starve the others from reporting.
      // We added the realtime / sync / JWT probes because the old
      // two-probe version let a broken chat pub/sub or a dropped JWT
      // signing key pass `/readyz` → LB kept routing traffic while
      // the app silently dropped messages.
      const probes: Array<{ name: string; run: () => Promise<unknown> }> = [
        { name: 'postgres', run: () => app.userStore.ping() },
        { name: 'redis', run: () => app.refreshTokenStore.ping() },
        {
          name: 'chat_realtime',
          // Optional-chaining so the probe no-ops on builds that don't
          // wire a hub (shouldn't happen in prod; kept defensive).
          run: async () => {
            await app.chatRealtimeHub?.ping?.();
          },
        },
        {
          name: 'p2p_sync',
          run: async () => {
            await app.syncRuntime?.ping?.();
          },
        },
        {
          name: 'jwt_sign_verify',
          // Synthetic sign/verify round-trip — catches missing or
          // broken signing keys (most common failure: key rotation
          // without rollout, config-map drift, empty PEM).
          run: async () => {
            const token = app.jwt.sign({ sub: 'readyz' });
            await app.jwt.verify(token);
          },
        },
      ];

      const results = await Promise.allSettled(probes.map((probe) => probe.run()));

      const checks = probes.map((probe, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          return { name: probe.name, status: 'ok' as const };
        }
        const detail =
          result.reason instanceof Error
            ? result.reason.message
            : `${probe.name} unavailable`;
        return { name: probe.name, status: 'degraded' as const, detail };
      });

      const ready = checks.every((check) => check.status === 'ok');
      reply.code(ready ? 200 : 503);

      return {
        status: ready ? 'ok' : 'degraded',
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
        checks
      };
    }
  );

  app.get(
    '/versionz',
    {
      schema: {
        summary: 'Runtime version probe',
        response: {
          200: versionResponseSchema,
        },
      },
    },
    async () => ({
      service: app.config.runtime.serviceName,
      version: app.config.runtime.version,
      runtime: process.version,
      timestamp: new Date().toISOString(),
    }),
  );

  // Prometheus-format metrics endpoint. Scraped by Grafana Agent /
  // Prometheus server (staging) and the Cloud Run sidecar (future).
  // prom-client emits `text/plain; version=0.0.4` which is the canonical
  // content-type for Prometheus exposition format 0.0.4.
  //
  // Defensive guard: production was observed returning a 500 here with
  // "Cannot read properties of undefined (reading 'register')" even though
  // `app.decorate('metrics', metrics)` runs cleanly in tests. Rather than
  // continue panicking the endpoint, we log what's actually attached to
  // the app instance at request time and return 503 — the standard
  // "backend not ready" response a Prometheus scraper understands and
  // retries cleanly. Once the root cause is pinned, we can reassert the
  // invariant with a non-optional access.
  app.get('/metrics', async (request, reply) => {
    const registry = app.metrics?.register;
    if (!registry) {
      request.log.error(
        {
          hasMetrics: Boolean(app.metrics),
          decoratorKeys: app.metrics ? Object.keys(app.metrics) : [],
        },
        '/metrics: registry unavailable — metrics decorator missing at request time',
      );
      reply.code(503);
      reply.header('content-type', 'text/plain; charset=utf-8');
      return 'metrics registry unavailable';
    }
    reply.header('content-type', registry.contentType);
    return registry.metrics();
  });

  // Legacy JSON metrics kept at `/metrics.json` for backward-compat with
  // any existing smoke tests / dashboards that parse the structured shape.
  // Prefer `/metrics` (Prometheus text format) for new integrations.
  app.get(
    '/metrics.json',
    {
      schema: {
        summary: 'Legacy JSON runtime metrics (superseded by Prometheus /metrics)',
        response: {
          200: metricsResponseSchema,
        },
      },
    },
    async () => ({
      service: app.config.runtime.serviceName,
      version: app.config.runtime.version,
      uptime_seconds: Number(process.uptime().toFixed(3)),
      node_env: app.config.env,
      timestamp: new Date().toISOString(),
    }),
  );
};
