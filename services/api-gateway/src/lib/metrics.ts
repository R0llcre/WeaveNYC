import type { FastifyInstance } from 'fastify';
import {
  Counter,
  Gauge,
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
 * Outcome label for each hop of a community sync event through the P2P
 * runtime. We split the durable append and the live fanout so an operator
 * can quickly tell `durable_fail` (data-loss risk) from `fanout_fail`
 * (transient WS delivery gap) and from `duplicate` (benign replay).
 */
export type P2PSyncResult =
  | 'durable_ok'
  | 'durable_fail'
  | 'fanout_ok'
  | 'fanout_fail'
  | 'duplicate';

/**
 * Bucket label for `p2pSyncErrorsTotal`. Combined with `op` this gives a 2-D
 * breakdown that's coarse enough to stay under cardinality budgets but rich
 * enough to see "the Redis publisher is sick" vs "tokens keep failing scope
 * check" at a glance.
 */
export type P2PSyncErrorOp =
  | 'publish'
  | 'fanout'
  | 'list'
  | 'bootstrap'
  | 'ws_auth';

export type P2PSyncErrorKind =
  | 'redis'
  | 'db'
  | 'ws'
  | 'validation'
  | 'runtime';

export type P2PBootstrapOutcome = 'ok' | 'denied' | 'error';

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
  /**
   * Counts each P2P sync event by `event_type` and runtime result. The split
   * between `durable_*` (postgres INSERT) and `fanout_*` (Redis pub/sub +
   * WebSocket broadcast) lets an operator localise faults without reading
   * logs. `duplicate` covers replayed envelopes that were already persisted.
   */
  p2pSyncEventsTotal: Counter<'event_type' | 'result'>;
  /**
   * Every swallowed / logged P2P error bumps this counter with the
   * operation and error kind, so Sentry and Prometheus stay in sync. Kept
   * coarse-grained on purpose to avoid cardinality explosion.
   */
  p2pSyncErrorsTotal: Counter<'op' | 'kind'>;
  /**
   * Distribution of `now - occurred_at` sampled at fanout time. Surfaces
   * end-to-end lag between the write that triggered an event and the
   * moment a live subscriber would have received it.
   */
  p2pSyncLagSeconds: Histogram<string>;
  /**
   * Current active WebSocket connections on `/v1/ws/p2p`, labelled per
   * community so anchors can see whether their overlay is populated.
   * Incremented at `attachConnection`, decremented at `detachConnection`.
   */
  p2pActiveConnections: Gauge<'community_id'>;
  /**
   * Bootstrap outcomes: `ok` on success, `denied` on auth/membership
   * rejection, `error` on unexpected server failure.
   */
  p2pBootstrapTotal: Counter<'outcome'>;
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

  const p2pSyncEventsTotal = new Counter({
    name: 'p2p_sync_events_total',
    help: 'Community sync events by event_type and runtime stage result.',
    labelNames: ['event_type', 'result'] as const,
    registers: [register],
  });

  const p2pSyncErrorsTotal = new Counter({
    name: 'p2p_sync_errors_total',
    help: 'Errors encountered while publishing, fanning out, or reading community sync events.',
    labelNames: ['op', 'kind'] as const,
    registers: [register],
  });

  const p2pSyncLagSeconds = new Histogram({
    name: 'p2p_sync_lag_seconds',
    help: 'End-to-end lag between a sync event occurring and its fanout attempt.',
    buckets: [0.1, 0.5, 1, 5, 15, 60],
    registers: [register],
  });

  const p2pActiveConnections = new Gauge({
    name: 'p2p_active_connections',
    help: 'Number of currently attached /v1/ws/p2p websocket clients per community.',
    labelNames: ['community_id'] as const,
    registers: [register],
  });

  const p2pBootstrapTotal = new Counter({
    name: 'p2p_bootstrap_total',
    help: 'Outcome of /v1/communities/:id/bootstrap calls.',
    labelNames: ['outcome'] as const,
    registers: [register],
  });

  return {
    register,
    httpRequestsTotal,
    httpRequestDurationSeconds,
    authChallengesTotal,
    verifiedMatchesTotal,
    accountDeletionsTotal,
    p2pSyncEventsTotal,
    p2pSyncErrorsTotal,
    p2pSyncLagSeconds,
    p2pActiveConnections,
    p2pBootstrapTotal,
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
