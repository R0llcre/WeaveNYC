/// <reference lib="webworker" />

/*
 * WeaveNYC community P2P sync worker.
 *
 * The worker runs off the main thread so catch-up polling and live WebSocket
 * frames don't block UI rendering. The testable surface (see
 * `createP2PSyncRuntime` below) is exported so we can unit-test lifecycle
 * behaviour with mock `fetch` / `WebSocket` / timer implementations — the IIFE
 * at the bottom of the file is what actually runs inside the bundled worker.
 *
 * Key invariants (most emerged from the M7 audit — P0/P1 findings):
 *   - Errors are typed (`SyncHttpError`) so consumers can distinguish 401 /
 *     403 / 410 / 429 / 5xx from network failures and react accordingly.
 *   - A Web Lock guards cursor writes so multiple tabs don't clobber each
 *     other's `since` cursor.
 *   - Reconnect uses exponential backoff + jitter capped at 60s so a misbehaving
 *     server can't drive the client into a tight retry loop.
 *   - Polling pauses while the WebSocket is open; resumes on close.
 *   - A single in-flight sync is enforced so timer ticks don't stack.
 *   - `online` / `offline` events drive the phase transitions even without
 *     explicit `sync()` calls from the main thread.
 */

import { getCommunitySyncWebSocketUrl } from '@/lib/api';
import {
  P2P_OVERLAY_PROTOCOL_VERSION,
  communityBootstrapResponseSchema,
  communitySyncDeltaResponseSchema,
  p2pSyncFrameSchema,
} from '@weavenyc/shared';
import type {
  CommunityBootstrapResponse,
  CommunitySyncEvent,
  CommunitySyncDeltaResponse,
  P2PSyncErrorCategory,
  P2PSyncPhase,
  P2PSyncStatus,
  P2PTransportLabel,
} from '@/lib/types';

// --- Error types -----------------------------------------------------------

/**
 * Typed HTTP error raised by `fetchJson`. Exposes the status code + optional
 * `code` field (from JSON error bodies like `{"code":"cursor_expired"}`) so
 * callers can branch without string-sniffing.
 */
export class SyncHttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    message: string,
    options: { code?: string; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'SyncHttpError';
    this.status = status;
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function categorizeError(error: unknown): P2PSyncErrorCategory {
  if (error instanceof SyncHttpError) {
    if (error.status === 401) return 'auth';
    if (error.status === 403) return 'auth';
    if (error.status >= 500) return 'server';
    if (error.status === 0) return 'network';
    return 'server';
  }

  if (typeof error === 'object' && error && 'name' in error && (error as { name?: string }).name === 'AbortError') {
    return 'network';
  }

  return 'unknown';
}

// --- Types shared with the main-thread client ------------------------------
//
// Frame shapes are defined on the server side as `p2pSyncFrameSchema` in
// `@weavenyc/shared`. Every inbound frame goes through Zod `safeParse`
// below so a server-side schema change fails loudly on the client instead
// of silently poisoning the cache (P1 finding 2).

type StartCommand = {
  type: 'start';
  apiBaseUrl: string;
  accessToken: string;
  communityId: string;
  peerId: string;
  mdnsDemoEnabled: boolean;
  since: string | null;
  limit: number;
};

type Command =
  | StartCommand
  | { type: 'sync' }
  | { type: 'update-config'; mdnsDemoEnabled: boolean }
  | { type: 'stop' };

type WebSocketLike = {
  readyState: number;
  close: (code?: number, reason?: string) => void;
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
};

type WebSocketConstructor = new (url: string, protocols?: string | string[]) => WebSocketLike;

// --- Runtime configuration (for testing injection) -------------------------

export type P2PSyncRuntimeDeps = {
  post: (message: unknown) => void;
  fetch: typeof fetch;
  webSocketCtor: WebSocketConstructor;
  webSocketOpenConst: number;
  setTimeout: (handler: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  setInterval: (handler: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
  now: () => number;
  randomUuid: () => string;
  isOnline: () => boolean;
  withCursorLock: (key: string, fn: () => Promise<void>) => Promise<void>;
};

type WorkerState = {
  apiBaseUrl: string;
  accessToken: string;
  communityId: string;
  peerId: string;
  mdnsDemoEnabled: boolean;
  since: string | null;
  limit: number;
  timer: unknown;
  reconnectTimer: unknown;
  socket: WebSocketLike | null;
  shuttingDown: boolean;
  peerCount: number;
  websocketUrl: string | null;
  // Nullable here even though the server-side response schema makes
  // `latest_snapshot` non-null, because on first boot we have no snapshot
  // to show (fresh community, or before bootstrap completes).
  latestSnapshot: CommunitySyncDeltaResponse['latest_snapshot'] | null;
  // Backoff state for the WS reconnect loop — see `scheduleReconnect`.
  reconnectAttempts: number;
  // In-flight guard for `runSyncOnly` so timer ticks don't stack.
  inFlight: boolean;
  // Fresh UUID per bootstrap/run so Sentry + server logs share a trace id.
  requestId: string | null;
};

const HTTP_TIMEOUT_MS = 15_000;
const RECONNECT_MAX_DELAY_MS = 60_000;
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_JITTER_MS = 500;
const POLL_INTERVAL_MS = 30_000;
const CATCHUP_MAX_PAGES = 50;
const CURSOR_EXPIRED_CODE = 'cursor_expired';

/**
 * Module-scoped counter bumped by `safeParse` rejection paths. Attached to
 * the next `error` message so Sentry picks up the spike — a sustained
 * non-zero value means the server has drifted its wire format. The
 * protocol_version check (which halts the loop) is the first line of
 * defence; this counter catches the "one field changed" drift that slips
 * past the version tag.
 */
let schemaDriftCount = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createDefaultState(): WorkerState {
  return {
    apiBaseUrl: '',
    accessToken: '',
    communityId: '',
    peerId: '',
    mdnsDemoEnabled: false,
    since: null,
    limit: 100,
    timer: null,
    reconnectTimer: null,
    socket: null,
    shuttingDown: false,
    peerCount: 0,
    websocketUrl: null,
    latestSnapshot: null,
    reconnectAttempts: 0,
    inFlight: false,
    requestId: null,
  };
}

/**
 * Factory for the P2P sync runtime. The worker entry point wires in real
 * globals; the unit tests wire in mocks. Keeping this side-effect-free lets us
 * exercise the lifecycle without spinning up a real DedicatedWorkerGlobalScope.
 */
export function createP2PSyncRuntime(deps: P2PSyncRuntimeDeps) {
  let state: WorkerState = createDefaultState();

  function clearPollTimer() {
    if (state.timer !== null) {
      deps.clearInterval(state.timer);
      state.timer = null;
    }
  }

  function clearReconnectTimer() {
    if (state.reconnectTimer !== null) {
      deps.clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
  }

  function closeSocket() {
    if (state.socket) {
      try {
        state.socket.close();
      } catch {
        // ignore socket close failures
      }
      state.socket = null;
    }
  }

  function transportLabel(): P2PTransportLabel {
    return state.mdnsDemoEnabled ? 'mdns-demo' : 'bootstrap';
  }

  function buildStatus(overrides: Partial<P2PSyncStatus> = {}): P2PSyncStatus {
    return {
      communityId: state.communityId,
      enabled: Boolean(state.communityId),
      mdnsDemoEnabled: state.mdnsDemoEnabled,
      phase: 'disabled',
      peerId: state.peerId || null,
      peerCount: state.peerCount,
      transportLabel: transportLabel(),
      lastSyncAt: null,
      latestSnapshot: state.latestSnapshot,
      lastError: null,
      errorCategory: null,
      ...overrides,
    };
  }

  function postStatus(phase: P2PSyncPhase, overrides: Partial<P2PSyncStatus> = {}) {
    deps.post({
      type: 'status',
      status: buildStatus({ phase, ...overrides }),
    });
  }

  function offlinePhase(): P2PSyncPhase {
    return deps.isOnline() ? 'degraded' : 'offline';
  }

  /**
   * Emit an error status to the main thread. `error` gets stringified for the
   * existing `lastError` slot, and we include an `errorCategory` so the main
   * thread can choose how to surface it (toast, reauth prompt, etc).
   *
   * `categoryOverride` lets the schema-drift path bypass the default
   * `SyncHttpError`-based categorization and flag `'schema'` instead so the
   * UI shows "server wire format changed" rather than "server 5xx".
   */
  function postError(
    error: unknown,
    phaseHint?: P2PSyncPhase,
    extra: Partial<P2PSyncStatus> = {},
    categoryOverride?: P2PSyncErrorCategory,
  ) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'P2P sync failed';
    const category = categoryOverride ?? categorizeError(error);
    const requestId = state.requestId;
    const phase = phaseHint ?? offlinePhase();

    deps.post({
      type: 'error',
      status: buildStatus({
        phase,
        lastError: message,
        errorCategory: category,
        ...extra,
      }),
      error: message,
      requestId: requestId ?? undefined,
      errorCategory: category,
      status_code: error instanceof SyncHttpError ? error.status : undefined,
      // Sentry listens for this — a non-zero schemaDriftCount after a
      // successful start means the server has drifted.
      schemaDriftCount,
    });
  }

  function bumpSnapshot(event: CommunitySyncEvent) {
    const currentCount = state.latestSnapshot?.event_count ?? 0;
    const lastEventAt = state.latestSnapshot?.last_event_at;

    state.latestSnapshot = {
      last_event_at:
        !lastEventAt || event.occurred_at.localeCompare(lastEventAt) >= 0
          ? event.occurred_at
          : lastEventAt,
      event_count: currentCount + 1,
    };
  }

  async function persistCursor(nextSince: string | null) {
    if (!state.communityId) {
      return;
    }

    const commit = async () => {
      deps.post({
        type: 'cursor-update',
        communityId: state.communityId,
        since: nextSince,
        updatedAt: new Date().toISOString(),
      });
    };

    // Web Lock prevents two tabs from clobbering each other's cursor writes.
    // See `createDefaultDeps` for the fallback path when the API is missing.
    await deps.withCursorLock(`p2p-sync-cursor-${state.communityId}`, commit);
  }

  function updateSince(nextSince: string | null) {
    if (!nextSince) {
      return;
    }

    state.since = nextSince;
    void persistCursor(nextSince);
  }

  function postSync(delta: CommunitySyncDeltaResponse) {
    deps.post({
      type: 'sync',
      status: buildStatus({
        phase: 'ready',
        peerCount: state.peerCount,
        lastSyncAt: delta.server_time,
        latestSnapshot: delta.latest_snapshot,
        lastError: null,
        errorCategory: null,
      }),
      delta,
    });
  }

  async function fetchJson<T>(path: string): Promise<T> {
    // AbortSignal.timeout returns a signal that fires after `ms`. If the
    // runtime is older and doesn't support it, fall through to a naked fetch
    // — the existing WS reconnect loop will still catch the hang eventually.
    let signal: AbortSignal | undefined;
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      signal = AbortSignal.timeout(HTTP_TIMEOUT_MS);
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${state.accessToken}`,
    };
    if (state.requestId) {
      headers['x-request-id'] = state.requestId;
    }

    let response: Response;
    try {
      response = await deps.fetch(`${state.apiBaseUrl}${path}`, {
        cache: 'no-store',
        headers,
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SyncHttpError(0, 'HTTP request timed out', { cause: error });
      }
      throw new SyncHttpError(0, error instanceof Error ? error.message : 'Network error', {
        cause: error,
      });
    }

    if (!response.ok) {
      // Pull structured error details when available so we can branch on
      // `code` (e.g. cursor_expired) without parsing free-form strings.
      let code: string | undefined;
      let message = '';
      try {
        const cloned = response.clone();
        const body = await cloned.json();
        if (isRecord(body) && typeof body.code === 'string') {
          code = body.code;
        }
        if (isRecord(body) && typeof body.message === 'string') {
          message = body.message;
        }
      } catch {
        // Body wasn't JSON — fall through and use text().
      }

      if (!message) {
        try {
          message = await response.text();
        } catch {
          message = '';
        }
      }

      const retryAfter = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : undefined;

      throw new SyncHttpError(
        response.status,
        `HTTP ${response.status} ${message}`.trim(),
        {
          code,
          retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
        },
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Raised when `safeParse` rejects an inbound delta / bootstrap payload.
   * Caught at the bootstrap / poll sites so we surface a structured
   * "schema_drift" error rather than a generic parse exception.
   */
  class SchemaDriftError extends Error {
    constructor(stage: string, issues: string) {
      super(`schema_drift at ${stage}: ${issues}`);
      this.name = 'SchemaDriftError';
    }
  }

  async function fetchSyncDeltaPage(): Promise<CommunitySyncDeltaResponse> {
    const params = new URLSearchParams();
    if (state.since) {
      params.set('since', state.since);
    }
    params.set('limit', String(state.limit));

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const rawDelta = await fetchJson<unknown>(
      `/v1/communities/${state.communityId}/sync${suffix}`,
    );

    // Zod safeParse: drop the payload on rejection rather than letting the
    // cache swallow an incompatible shape (P1 finding 2). Bump the drift
    // counter so Sentry can see the spike.
    const parsed = communitySyncDeltaResponseSchema.safeParse(rawDelta);
    if (!parsed.success) {
      schemaDriftCount += 1;
      throw new SchemaDriftError(
        'sync delta',
        parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', '),
      );
    }

    // Version gate: a mismatch means the server is speaking a different
    // protocol than we compiled against. Halt the loop — retrying would
    // just poison the cache with incompatible data.
    if (parsed.data.protocol_version !== P2P_OVERLAY_PROTOCOL_VERSION) {
      throw new SchemaDriftError(
        'sync delta',
        `protocol_version_mismatch: got ${parsed.data.protocol_version}, expected ${P2P_OVERLAY_PROTOCOL_VERSION}`,
      );
    }

    const delta = parsed.data;
    updateSince(delta.next_since);
    state.latestSnapshot = delta.latest_snapshot;
    return delta;
  }

  /**
   * Pages through `/sync` until the server signals exhaustion. Previously we
   * fetched exactly one page then opened the WebSocket — clients that had been
   * offline for more than `limit` events would miss the tail until the next
   * 30s poll tick (audit P5.6 / P2.2). We cap at `CATCHUP_MAX_PAGES` to defend
   * against a pathological server that never advances `next_since`.
   *
   * Exhaustion is driven by the server's explicit `has_more` flag (P1
   * finding 6 / P2 finding 2) — the prior heuristic (`events.length < limit`)
   * races the server's cursor semantics under concurrent writes.
   */
  async function fetchAllCatchupPages(): Promise<CommunitySyncDeltaResponse | null> {
    let lastDelta: CommunitySyncDeltaResponse | null = null;
    let previousSince: string | null = state.since;
    for (let page = 0; page < CATCHUP_MAX_PAGES; page += 1) {
      const delta = await fetchSyncDeltaPage();
      if (delta.events.length > 0) {
        postSync(delta);
      }
      lastDelta = delta;

      // Stop when:
      //   1. Server signaled end-of-stream (`has_more === false`).
      //   2. Cursor didn't advance — belt-and-suspenders against a broken
      //      server that keeps emitting the same window.
      if (!delta.has_more) {
        break;
      }
      if (state.since === previousSince) {
        break;
      }
      previousSince = state.since;
    }
    return lastDelta;
  }

  /**
   * Reset cursor and re-bootstrap after the server tells us the cursor is
   * stale (410 Gone / 409 Conflict / `cursor_expired`). The main thread owns
   * the persisted cursor, so we push `since = null` through the Web-Lock
   * bridge, then re-run the full bootstrap.
   */
  async function recoverFromStaleCursor() {
    state.since = null;
    await persistCursor(null);
    await bootstrapAndSync({ retryOnFailure: true });
  }

  async function bootstrapAndSync(options: { retryOnFailure?: boolean } = {}) {
    state.requestId = deps.randomUuid();
    postStatus('connecting');

    try {
      const rawBootstrap = await fetchJson<unknown>(
        `/v1/communities/${state.communityId}/bootstrap`,
      );

      // Runtime validation (P1 finding 2). Prior to this the raw JSON was
      // cast straight to `CommunityBootstrapResponse` with zero guard
      // against drift.
      const parsed = communityBootstrapResponseSchema.safeParse(rawBootstrap);
      if (!parsed.success) {
        schemaDriftCount += 1;
        throw new SchemaDriftError(
          'bootstrap',
          parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join(', '),
        );
      }

      // Version gate — see comment on `fetchSyncDeltaPage`.
      if (parsed.data.protocol_version !== P2P_OVERLAY_PROTOCOL_VERSION) {
        // Loud devtools warning so operators debugging the pilot can see
        // the mismatch without waiting for Sentry.
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            `[p2p-sync] protocol_version_mismatch: got ${parsed.data.protocol_version}, expected ${P2P_OVERLAY_PROTOCOL_VERSION}. Halting sync loop.`,
          );
        }
        throw new SchemaDriftError(
          'bootstrap',
          `protocol_version_mismatch: got ${parsed.data.protocol_version}, expected ${P2P_OVERLAY_PROTOCOL_VERSION}`,
        );
      }

      const bootstrap: CommunityBootstrapResponse = parsed.data;

      state.latestSnapshot = bootstrap.latest_snapshot;
      state.peerCount = 0;
      state.websocketUrl =
        bootstrap.anchor_node?.websocket_url ?? bootstrap.relay_nodes[0]?.websocket_url ?? null;

      await fetchAllCatchupPages();
      connectSocket();
    } catch (error) {
      if (error instanceof SchemaDriftError) {
        // Schema drift / protocol_version mismatch — the server is on an
        // incompatible wire revision. Retrying would just re-poison
        // the cache. Halt the loop and surface a `'schema'` category to
        // the main thread so the UI can show the right message.
        postError(
          error,
          'degraded',
          { lastError: 'protocol_version_mismatch' },
          'schema',
        );
        clearReconnectTimer();
        clearPollTimer();
        return;
      }
      if (error instanceof SyncHttpError) {
        if (error.status === 401) {
          // User must reauth via Verify flow before the worker can resume.
          // Stop retrying — an explicit `sync()` will re-drive once the main
          // thread swaps in a fresh access token.
          postError(error, 'auth_required');
          clearReconnectTimer();
          clearPollTimer();
          return;
        }
        if (error.status === 403) {
          postError(error, 'forbidden');
          clearReconnectTimer();
          clearPollTimer();
          return;
        }
        if (error.status === 410 || error.status === 409 || error.code === CURSOR_EXPIRED_CODE) {
          await recoverFromStaleCursor();
          return;
        }
        if (error.status === 429) {
          const delayMs = (error.retryAfterSeconds ?? 1) * 1000;
          postError(error, offlinePhase());
          if (options.retryOnFailure && !state.shuttingDown) {
            scheduleReconnect(delayMs);
          }
          return;
        }
      }

      postError(error, offlinePhase());
      if (options.retryOnFailure && !state.shuttingDown) {
        scheduleReconnect();
      }
    }
  }

  async function runSyncOnly() {
    // In-flight guard: if the previous tick is still running (e.g. because the
    // server is slow), skip this tick rather than stacking requests. The
    // interval will try again on the next fire.
    if (state.inFlight) {
      return;
    }
    state.inFlight = true;

    // Fresh request id per tick — lets Sentry correlate this poll with any
    // server-side log lines.
    state.requestId = deps.randomUuid();
    try {
      const delta = await fetchSyncDeltaPage();
      postSync(delta);
    } catch (error) {
      if (error instanceof SchemaDriftError) {
        // Schema drift during the poll loop: halt poll + reconnect so we
        // don't keep re-fetching incompatible payloads.
        postError(
          error,
          'degraded',
          { lastError: 'protocol_version_mismatch' },
          'schema',
        );
        clearPollTimer();
        clearReconnectTimer();
        return;
      }
      if (error instanceof SyncHttpError) {
        if (error.status === 401) {
          postError(error, 'auth_required');
          clearPollTimer();
          return;
        }
        if (error.status === 403) {
          postError(error, 'forbidden');
          clearPollTimer();
          return;
        }
        if (error.status === 410 || error.status === 409 || error.code === CURSOR_EXPIRED_CODE) {
          await recoverFromStaleCursor();
          return;
        }
        if (error.status === 429) {
          postError(error, offlinePhase());
          const delayMs = (error.retryAfterSeconds ?? 1) * 1000;
          if (!state.shuttingDown) {
            scheduleReconnect(delayMs);
          }
          return;
        }
      }

      postError(error, offlinePhase());
      // Trigger a reconnect on timeout / 5xx so the WS can pick up again when
      // the backend recovers.
      if (!state.shuttingDown) {
        scheduleReconnect();
      }
    } finally {
      state.inFlight = false;
    }
  }

  function startPollLoop() {
    clearPollTimer();
    state.timer = deps.setInterval(() => {
      // Pause polling while the WS is open — the socket already streams every
      // event. This eliminates the thundering-herd problem where both paths
      // race to write the same cursor (audit P4.1 / P5.10).
      if (state.socket && state.socket.readyState === deps.webSocketOpenConst) {
        return;
      }
      void runSyncOnly();
    }, POLL_INTERVAL_MS);
  }

  function computeReconnectDelay(): number {
    const base = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** state.reconnectAttempts, RECONNECT_MAX_DELAY_MS);
    return base + Math.random() * RECONNECT_JITTER_MS;
  }

  function scheduleReconnect(overrideDelay?: number) {
    if (state.shuttingDown || state.reconnectTimer !== null || !state.communityId) {
      return;
    }

    const delay = overrideDelay ?? computeReconnectDelay();
    state.reconnectAttempts += 1;

    state.reconnectTimer = deps.setTimeout(() => {
      state.reconnectTimer = null;
      // Bootstrap refreshes short-lived WS credentials, so reconnects must
      // always re-bootstrap before opening a new socket.
      void bootstrapAndSync({ retryOnFailure: true });
    }, delay);
  }

  function connectSocket() {
    if (!state.websocketUrl || state.socket || state.shuttingDown) {
      return;
    }

    let websocketUrl: string;
    try {
      websocketUrl = getCommunitySyncWebSocketUrl(
        state.websocketUrl,
        state.accessToken,
        state.communityId,
      );
    } catch {
      return;
    }

    // Surface the request_id so the server can join log lines. Not every
    // Fastify build honours header pass-through on the WS upgrade, so we
    // include it as a query param too.
    if (state.requestId) {
      try {
        const url = new URL(websocketUrl);
        url.searchParams.set('request_id', state.requestId);
        websocketUrl = url.toString();
      } catch {
        // ignore URL construction errors — the server will assign its own id
      }
    }

    let socket: WebSocketLike;
    try {
      socket = new deps.webSocketCtor(websocketUrl);
    } catch {
      scheduleReconnect();
      return;
    }

    state.socket = socket;

    socket.addEventListener('open', () => {
      // We made it through the handshake — reset the reconnect backoff so the
      // NEXT disconnection starts from base delay rather than whatever
      // exponential tier we were at.
      state.reconnectAttempts = 0;
      postStatus('connecting', { lastError: null, errorCategory: null });
    });

    socket.addEventListener('message', (event) => {
      if (state.socket !== socket) {
        return;
      }

      const data = (event as MessageEvent).data;

      let raw: unknown;
      try {
        raw = JSON.parse(String(data));
      } catch {
        return;
      }

      // safeParse the frame — a drift (e.g. a new aggregate_type the
      // shared enum doesn't cover yet) is dropped and counted. The
      // connection itself stays open so heartbeat / valid frames still
      // flow. See P1 finding 2.
      const parsed = p2pSyncFrameSchema.safeParse(raw);
      if (!parsed.success) {
        schemaDriftCount += 1;
        deps.post({
          type: 'error',
          error: 'schema_drift',
          errorCategory: 'schema',
          schemaDriftCount,
          status_code: undefined,
          requestId: state.requestId ?? undefined,
          status: buildStatus({
            phase: state.socket ? 'ready' : offlinePhase(),
            lastError: 'schema_drift',
            errorCategory: 'schema',
          }),
        });
        return;
      }

      const frame = parsed.data;

      if (frame.frame_type === 'ready') {
        // Version gate on the ready frame too — catches the case where a
        // mid-session server upgrade drifts the wire format.
        if (frame.protocol_version !== P2P_OVERLAY_PROTOCOL_VERSION) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(
              `[p2p-sync] protocol_version_mismatch on WS ready frame: got ${frame.protocol_version}, expected ${P2P_OVERLAY_PROTOCOL_VERSION}. Halting sync loop.`,
            );
          }
          postError(
            new Error('protocol_version_mismatch'),
            'degraded',
            { lastError: 'protocol_version_mismatch' },
            'schema',
          );
          clearReconnectTimer();
          clearPollTimer();
          try {
            socket.close();
          } catch {
            // ignore
          }
          return;
        }

        state.peerCount = frame.peer_count;
        state.latestSnapshot = frame.latest_snapshot;
        postStatus('ready', {
          peerCount: state.peerCount,
          lastSyncAt: new Date(deps.now()).toISOString(),
          latestSnapshot: state.latestSnapshot,
          transportLabel: transportLabel(),
          lastError: null,
          errorCategory: null,
        });
        return;
      }

      if (frame.frame_type === 'heartbeat') {
        postStatus('ready', {
          lastSyncAt: frame.occurred_at,
          latestSnapshot: state.latestSnapshot,
          lastError: null,
          errorCategory: null,
        });
        return;
      }

      // frame_type === 'event'
      bumpSnapshot(frame.event);
      postSync({
        protocol_version: P2P_OVERLAY_PROTOCOL_VERSION,
        events: [frame.event],
        next_since: state.since,
        server_time: frame.event.occurred_at,
        latest_snapshot: state.latestSnapshot ?? { last_event_at: null },
        has_more: false,
      });
    });

    socket.addEventListener('close', () => {
      const isCurrentSocket = state.socket === socket;
      if (isCurrentSocket) {
        state.socket = null;
      }
      if (!isCurrentSocket || state.shuttingDown) {
        return;
      }

      state.peerCount = 0;

      postStatus(offlinePhase(), {
        peerCount: 0,
        latestSnapshot: state.latestSnapshot,
        lastError: 'Live sync disconnected. Falling back to catch-up polling.',
        errorCategory: 'network',
        transportLabel: transportLabel(),
      });
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      if (state.socket !== socket) {
        return;
      }

      try {
        socket.close();
      } catch {
        // ignore close errors from broken sockets
      }
    });
  }

  function handleCommand(command: Command) {
    if (command.type === 'stop') {
      state.shuttingDown = true;
      clearPollTimer();
      clearReconnectTimer();
      closeSocket();
      state = createDefaultState();
      // Reset the schema-drift counter so the next session's Sentry
      // datapoint starts at zero.
      schemaDriftCount = 0;
      postStatus('disabled', {
        enabled: false,
        communityId: '',
        peerId: null,
      });
      return;
    }

    if (command.type === 'update-config') {
      state.mdnsDemoEnabled = command.mdnsDemoEnabled;
      postStatus(state.socket ? 'ready' : 'connecting', {
        transportLabel: transportLabel(),
      });
      return;
    }

    if (command.type === 'sync') {
      if (!state.communityId) {
        postStatus('disabled', { enabled: false });
        return;
      }

      void runSyncOnly();
      return;
    }

    // type === 'start'
    state.shuttingDown = true;
    clearReconnectTimer();
    closeSocket();
    state = {
      ...createDefaultState(),
      apiBaseUrl: command.apiBaseUrl,
      accessToken: command.accessToken,
      communityId: command.communityId,
      peerId: command.peerId,
      mdnsDemoEnabled: command.mdnsDemoEnabled,
      since: command.since,
      limit: command.limit,
      shuttingDown: false,
    };

    startPollLoop();
    void bootstrapAndSync({ retryOnFailure: true });
  }

  function onOnline() {
    if (!state.communityId || state.shuttingDown) {
      return;
    }
    // Drop backoff so the reconnect fires promptly now that we have a network
    // again.
    state.reconnectAttempts = 0;
    void bootstrapAndSync({ retryOnFailure: true });
  }

  function onOffline() {
    if (!state.communityId) {
      return;
    }
    postStatus('offline', {
      lastError: 'Device is offline',
      errorCategory: 'network',
    });
    closeSocket();
    clearReconnectTimer();
  }

  return {
    handleCommand,
    onOnline,
    onOffline,
    // Exposed for tests — not called by the production entry point.
    _state: () => state,
  };
}

// --- Real-worker entry point ------------------------------------------------

declare const self: DedicatedWorkerGlobalScope;

/**
 * Wire up real browser globals. Uses `navigator.locks` when available so cursor
 * writes from multiple tabs serialize; falls back to an unlocked write when
 * the API is missing (Safari < 15.4 etc).
 */
function createDefaultDeps(): P2PSyncRuntimeDeps {
  return {
    post: (msg) => self.postMessage(msg),
    fetch: (...args) => fetch(...args),
    webSocketCtor: WebSocket as unknown as WebSocketConstructor,
    webSocketOpenConst: WebSocket.OPEN,
    setTimeout: (handler, ms) => self.setTimeout(handler, ms),
    clearTimeout: (handle) => self.clearTimeout(handle as number),
    setInterval: (handler, ms) => self.setInterval(handler, ms),
    clearInterval: (handle) => self.clearInterval(handle as number),
    now: () => Date.now(),
    randomUuid: () => crypto.randomUUID(),
    isOnline: () => (typeof navigator !== 'undefined' ? navigator.onLine !== false : true),
    withCursorLock: async (key, fn) => {
      type LockManager = {
        request: (
          name: string,
          opts: { mode: 'exclusive' },
          fn: () => Promise<void>,
        ) => Promise<void>;
      };
      const locks =
        typeof navigator !== 'undefined'
          ? (navigator as unknown as { locks?: LockManager }).locks
          : undefined;
      if (locks && typeof locks.request === 'function') {
        await locks.request(key, { mode: 'exclusive' }, fn);
      } else {
        await fn();
      }
    },
  };
}

/**
 * Only execute the IIFE when running inside a real DedicatedWorker. Node-based
 * unit tests import the module via `createP2PSyncRuntime` and never touch the
 * IIFE (the guard also keeps vitest's module-load happy on the `node` env).
 */
function detectWorkerScope(): boolean {
  const anySelf = (globalThis as unknown as { self?: unknown }).self;
  if (typeof anySelf !== 'object' || anySelf === null) {
    return false;
  }
  // `importScripts` is defined in DedicatedWorkerGlobalScope but not in
  // Window / Node's globalThis. It's the cheapest way to discriminate.
  return typeof (anySelf as { importScripts?: unknown }).importScripts === 'function';
}

if (detectWorkerScope()) {
  const runtime = createP2PSyncRuntime(createDefaultDeps());

  self.addEventListener('message', (event: MessageEvent<Command>) => {
    runtime.handleCommand(event.data);
  });

  self.addEventListener('online', () => {
    runtime.onOnline();
  });

  self.addEventListener('offline', () => {
    runtime.onOffline();
  });
}
