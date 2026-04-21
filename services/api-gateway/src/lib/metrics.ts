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
   * Inbound conversation messages accepted by the API gateway
   * (POST /v1/conversations/:id/messages). Paired with
   * `chatMessagesDeliveredTotal` so `ChatDeliveryRateFloor` can tell the
   * two apart — sends landing at the gateway but zero deliveries going
   * out means the realtime fanout is broken rather than the send path.
   */
  chatMessagesSentTotal: Counter<string>;
  /**
   * Outbound realtime frames successfully handed to a connected user's
   * WebSocket. Counted once per `event_type` (message.created,
   * conversation.updated, …) per delivered frame.
   */
  chatMessagesDeliveredTotal: Counter<'event_type'>;
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

  const chatMessagesSentTotal = new Counter({
    name: 'chat_messages_sent_total',
    help: 'Conversation messages accepted by the API (POST /v1/conversations/:id/messages).',
    registers: [register],
  });

  const chatMessagesDeliveredTotal = new Counter({
    name: 'chat_messages_delivered_total',
    help: 'Realtime frames delivered to at least one connected user WebSocket, by event_type.',
    labelNames: ['event_type'] as const,
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
    chatMessagesSentTotal,
    chatMessagesDeliveredTotal,
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
 * `/v1/posts/:post_id`); otherwise we collapse to the literal string
 * `"unknown"`.
 *
 * History: an earlier revision fell back to `request.url` (the raw URL,
 * including IDs/tokens/querystrings) when Fastify couldn't match a route.
 * That blew up `http_requests_total{route=…}` on 404s, malformed URLs,
 * and every pre-route error — each unique URL minted a new series. Since
 * the same label feeds the latency histogram (O(N·bucketCount) series),
 * cardinality explosion was the dominant driver of Prometheus memory.
 * We always strip any querystring and collapse unknown routes to a
 * single `"unknown"` series, keeping cardinality bounded to the
 * registered Fastify routes plus one extra bucket.
 *
 * The second parameter (`_fallback`) is kept for call-site compatibility
 * but intentionally ignored — we never want to let a raw URL through.
 */
// The second parameter used to be a caller-provided fallback; the
// unused-vars lint rejects it even with the leading underscore. Prefix with
// `_` and tag with an eslint-disable comment to preserve call-site arity
// without triggering the rule.
export function normalizeRouteLabel(
  routeOption: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fallback: string
): string {
  if (routeOption && routeOption.length > 0) {
    // Defense-in-depth: even route templates shouldn't contain a `?`, but
    // strip one if it somehow appears so the label stays clean.
    return routeOption.split('?')[0];
  }

  return 'unknown';
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

export function recordChatMessageSent(app: FastifyInstance) {
  const metrics = app.metrics;
  if (!metrics) {
    return;
  }
  metrics.chatMessagesSentTotal.inc();
}

/**
 * Records one realtime delivery — one successful `socket.send()` per
 * connected user. We increment once per delivered frame (not per
 * recipient) to match what the alert rule wants: rate of frames
 * leaving the gateway for connected peers.
 */
export function recordChatMessageDelivered(
  app: FastifyInstance,
  eventType: string,
) {
  const metrics = app.metrics;
  if (!metrics) {
    return;
  }
  metrics.chatMessagesDeliveredTotal.inc({ event_type: eventType });
}
