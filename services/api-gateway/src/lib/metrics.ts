import type { FastifyInstance } from 'fastify';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export type AuthChallengeKind =
  | 'anonymous'
  | 'otp_start'
  | 'otp_verify'
  | 'magic_link_start'
  | 'magic_link_verify'
  | 'anchor_activate'
  | 'anchor_activate_confirm'
  | 'anchor_session_start'
  | 'anchor_session_verify'
  | 'anchor_session_recovery'
  | 'refresh';

export type AuthChallengeOutcome =
  | 'issued'
  | 'verified'
  | 'rejected'
  | 'rate_limited'
  | 'exhausted'
  | 'forbidden'
  | 'not_found'
  | 'error';

export type AccountDeletionStage = 'request' | 'confirm' | 'undelete';

export type AccountDeletionStatus =
  | 'issued'
  | 'scheduled'
  | 'restored'
  | 'rejected'
  | 'rate_limited'
  | 'blocked_last_anchor'
  | 'not_found'
  | 'error';

/**
 * Prometheus metrics registry for the api-gateway runtime. Created per-app
 * instance so tests can swap in isolated registries and the production
 * runtime surfaces a single canonical `/metrics` text bundle.
 */
export interface WeaveMetrics {
  register: Registry;
  httpRequestsTotal: Counter<'method' | 'route' | 'status_code'>;
  httpRequestDurationSeconds: Histogram<'method' | 'route'>;
  authChallengesTotal: Counter<'kind' | 'outcome'>;
  verifiedMatchesTotal: Counter<string>;
  accountDeletionsTotal: Counter<'status'>;
}

export function createWeaveMetrics(): WeaveMetrics {
  const register = new Registry();
  register.setDefaultLabels({ service: 'api-gateway' });
  // Default Node.js process metrics (event loop lag, CPU, memory, GC, etc.)
  // give Prometheus visibility into the runtime without extra config.
  collectDefaultMetrics({ register, prefix: 'weavenyc_' });

  const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests processed by the api-gateway.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [register],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route'] as const,
    buckets: [0.01, 0.05, 0.1, 0.3, 1, 3],
    registers: [register],
  });

  const authChallengesTotal = new Counter({
    name: 'auth_challenges_total',
    help: 'Authentication challenges emitted and resolved (OTP / magic link / anchor TOTP).',
    labelNames: ['kind', 'outcome'] as const,
    registers: [register],
  });

  const verifiedMatchesTotal = new Counter({
    name: 'verified_matches_total',
    help: 'Accepted neighbor-to-neighbor contact requests (pilot north star).',
    registers: [register],
  });

  const accountDeletionsTotal = new Counter({
    name: 'account_deletions_total',
    help: 'Account lifecycle events (delete request / confirm / undelete).',
    labelNames: ['status'] as const,
    registers: [register],
  });

  return {
    register,
    httpRequestsTotal,
    httpRequestDurationSeconds,
    authChallengesTotal,
    verifiedMatchesTotal,
    accountDeletionsTotal,
  };
}

/**
 * Normalize a Fastify route URL to a static label so high-cardinality
 * path params (uuids, zip codes, …) do not explode the metric series count.
 * When Fastify recognises the route it surfaces the template (e.g.
 * `/v1/posts/:post_id`); otherwise we fall back to `unknown`.
 */
export function normalizeRouteLabel(routeOption: string | undefined, fallback: string): string {
  if (routeOption && routeOption.length > 0) {
    return routeOption;
  }

  if (fallback.length === 0) {
    return 'unknown';
  }

  return fallback;
}

export function recordAuthChallenge(
  app: FastifyInstance,
  kind: AuthChallengeKind,
  outcome: AuthChallengeOutcome,
) {
  const metrics = app.metrics;
  if (!metrics) {
    return;
  }
  metrics.authChallengesTotal.inc({ kind, outcome });
}

export function recordAccountDeletion(
  app: FastifyInstance,
  status: AccountDeletionStatus,
) {
  const metrics = app.metrics;
  if (!metrics) {
    return;
  }
  metrics.accountDeletionsTotal.inc({ status });
}

export function recordVerifiedMatch(app: FastifyInstance) {
  const metrics = app.metrics;
  if (!metrics) {
    return;
  }
  metrics.verifiedMatchesTotal.inc();
}
