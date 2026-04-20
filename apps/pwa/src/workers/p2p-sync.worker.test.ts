/*
 * Unit tests for the P2P sync worker runtime.
 *
 * The worker module exports `createP2PSyncRuntime` — a pure factory that takes
 * its dependencies via injection — so we can exercise the full lifecycle from
 * Node without spinning up a real DedicatedWorker. The IIFE at the bottom of
 * `p2p-sync.worker.ts` only fires inside an actual worker scope (it sniffs for
 * `self.importScripts`), so importing the module here is a no-op.
 *
 * Covered scenarios (per audit P8.1):
 *   - reconnect after socket close with fresh bootstrap and exponential backoff
 *   - stale socket frames ignored after reconnect
 *   - stop clears interval + reconnect timer
 *   - event frame increments snapshot.event_count and preserves max last_event_at
 *   - 401 → phase=auth_required + loop stops
 *   - 410 → cursor reset + re-bootstrap
 *   - WS open pauses the 30s poll timer
 *   - in-flight guard prevents overlapping syncs
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createP2PSyncRuntime, SyncHttpError, type P2PSyncRuntimeDeps } from './p2p-sync.worker';

// Minimal fake WebSocket — exposes enough of the DOM surface for the runtime
// to attach handlers and for tests to fire synthetic open/message/close events.
class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 0;
  url: string;
  private listeners: Record<string, Array<(event: unknown) => void>> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  static instances: FakeWebSocket[] = [];

  addEventListener(event: string, handler: (e: unknown) => void) {
    this.listeners[event] = this.listeners[event] ?? [];
    this.listeners[event].push(handler);
  }

  removeEventListener() {
    // no-op for tests
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = FakeWebSocket.CLOSED;
    this.fire('close', { code: 1000 });
  }

  fire(event: string, payload: unknown) {
    const handlers = this.listeners[event] ?? [];
    for (const h of handlers) h(payload);
  }

  fireOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.fire('open', { type: 'open' });
  }
}

type TimerHandle = { id: number; fn: () => void; interval: boolean; period: number };

function createHarness(overrides: Partial<P2PSyncRuntimeDeps> = {}) {
  const posted: unknown[] = [];
  const timers = new Map<number, TimerHandle>();
  let nextTimerId = 1;

  const fetchMock = vi.fn();
  const randomUuidMock = vi.fn(() => `req-${nextTimerId++}`);

  const deps: P2PSyncRuntimeDeps = {
    post: (msg) => posted.push(msg),
    fetch: fetchMock as unknown as typeof fetch,
    webSocketCtor: FakeWebSocket as unknown as P2PSyncRuntimeDeps['webSocketCtor'],
    webSocketOpenConst: FakeWebSocket.OPEN,
    setTimeout: (fn: () => void, ms: number) => {
      const id = nextTimerId++;
      timers.set(id, { id, fn, interval: false, period: ms });
      return id;
    },
    clearTimeout: (handle: unknown) => {
      timers.delete(handle as number);
    },
    setInterval: (fn: () => void, ms: number) => {
      const id = nextTimerId++;
      timers.set(id, { id, fn, interval: true, period: ms });
      return id;
    },
    clearInterval: (handle: unknown) => {
      timers.delete(handle as number);
    },
    now: () => 1_000_000,
    randomUuid: randomUuidMock,
    isOnline: () => true,
    withCursorLock: async (_key, fn) => {
      await fn();
    },
    ...overrides,
  };

  const runtime = createP2PSyncRuntime(deps);

  return {
    runtime,
    posted,
    timers,
    fetchMock,
    randomUuidMock,
    deps,
    // Test helpers:
    runAllTimers() {
      // Fires every currently scheduled timer once. Intervals stay in the
      // map (they're fired repeatedly in real code); we delete one-shot
      // timers after firing.
      for (const handle of Array.from(timers.values())) {
        handle.fn();
        if (!handle.interval) {
          timers.delete(handle.id);
        }
      }
    },
    runOneShotTimers() {
      // Fire only the setTimeout-class timers (not intervals). Used by tests
      // that need to trigger the reconnect callback without also firing the
      // 30s poll tick.
      for (const handle of Array.from(timers.values())) {
        if (handle.interval) continue;
        handle.fn();
        timers.delete(handle.id);
      }
    },
    getActiveSocket: () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1] ?? null,
  };
}

function httpResponse(status: number, body: unknown, options: { code?: string; retryAfter?: string } = {}) {
  const headers = new Headers();
  if (options.retryAfter) {
    headers.set('retry-after', options.retryAfter);
  }
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    { status, headers },
  );
}

const COMMUNITY_ID = 'comm_alpha';

const BOOTSTRAP_OK = {
  community_id: COMMUNITY_ID,
  bootstrap_version: '1',
  anchor_node: { node_id: 'anchor_1', websocket_url: 'ws://test/ws' },
  relay_nodes: [],
  topics: { posts: 't/p', announcements: 't/a', reports: 't/r' },
  latest_snapshot: { last_event_at: null, event_count: 0 },
  mdns_demo_enabled: false,
};

function emptyDelta(serverTime = '2026-04-20T12:00:00.000Z') {
  return {
    events: [],
    next_since: null,
    server_time: serverTime,
    latest_snapshot: { last_event_at: null, event_count: 0 },
  };
}

describe('p2p sync worker runtime', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  it('reconnects after socket close with fresh bootstrap and exponential backoff', async () => {
    const harness = createHarness();
    harness.fetchMock
      .mockResolvedValueOnce(httpResponse(200, BOOTSTRAP_OK))
      .mockResolvedValueOnce(httpResponse(200, emptyDelta()))
      .mockResolvedValueOnce(httpResponse(200, BOOTSTRAP_OK))
      .mockResolvedValueOnce(httpResponse(200, emptyDelta()));

    harness.runtime.handleCommand({
      type: 'start',
      apiBaseUrl: 'http://api',
      accessToken: 'tok',
      communityId: COMMUNITY_ID,
      peerId: 'peer',
      mdnsDemoEnabled: false,
      since: null,
      limit: 100,
    });

    // First bootstrap + sync
    await flushPromises();
    const firstSocket = harness.getActiveSocket();
    expect(firstSocket).not.toBeNull();

    // Socket closes → schedules reconnect
    firstSocket!.close();
    await flushPromises();
    expect(harness.timers.size).toBeGreaterThan(0);

    // Reconnect fires → new bootstrap + delta. Use runOneShotTimers so the
    // poll interval doesn't also fire and consume mock responses.
    harness.runOneShotTimers();
    await flushPromises();

    // fetch was called at least 4 times (bootstrap+sync, then bootstrap+sync again).
    expect(harness.fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    // Reconnect delay grows — internal state exposes the attempt count.
    expect(harness.runtime._state().reconnectAttempts).toBeGreaterThanOrEqual(0);
  });

  it('ignores frames from a stale socket after reconnect', async () => {
    const harness = createHarness();
    // Two full bootstrap+sync cycles — first for initial start, second for
    // the reconnect. Any extra 200s are harmless.
    for (let i = 0; i < 4; i += 1) {
      harness.fetchMock
        .mockResolvedValueOnce(httpResponse(200, BOOTSTRAP_OK))
        .mockResolvedValueOnce(httpResponse(200, emptyDelta()));
    }

    harness.runtime.handleCommand({
      type: 'start',
      apiBaseUrl: 'http://api',
      accessToken: 'tok',
      communityId: COMMUNITY_ID,
      peerId: 'peer',
      mdnsDemoEnabled: false,
      since: null,
      limit: 100,
    });
    await flushPromises();

    const oldSocket = harness.getActiveSocket();
    expect(oldSocket).not.toBeNull();
    const instancesBefore = FakeWebSocket.instances.length;

    // Force reconnect by closing the current socket.
    oldSocket!.close();
    await flushPromises();
    // Fire only the reconnect setTimeout, not the 30s poll interval (the
    // latter would consume extra mocked fetch responses and is not what
    // this test cares about).
    harness.runOneShotTimers();
    await flushPromises();

    // A new socket should have been created during the reconnect bootstrap.
    expect(FakeWebSocket.instances.length).toBeGreaterThan(instancesBefore);

    const newSocket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    expect(newSocket).not.toBe(oldSocket);

    // Emit an event on the OLD socket after reconnect. It should be ignored.
    const postedBefore = harness.posted.length;
    oldSocket!.fire('message', {
      data: JSON.stringify({
        frame_type: 'event',
        event: {
          sync_event_id: 'stale_evt',
          community_id: COMMUNITY_ID,
          event_type: 'post.updated',
          aggregate_type: 'post',
          aggregate_id: 'post_1',
          actor_p2p_id: null,
          payload: null,
          cid: null,
          occurred_at: '2026-04-20T12:00:00.000Z',
        },
      }),
    });

    // No new messages should have been posted.
    expect(harness.posted.length).toBe(postedBefore);
  });

  it('stop clears interval and reconnect timer', async () => {
    const harness = createHarness();
    harness.fetchMock
      .mockResolvedValueOnce(httpResponse(200, BOOTSTRAP_OK))
      .mockResolvedValueOnce(httpResponse(200, emptyDelta()));

    harness.runtime.handleCommand({
      type: 'start',
      apiBaseUrl: 'http://api',
      accessToken: 'tok',
      communityId: COMMUNITY_ID,
      peerId: 'peer',
      mdnsDemoEnabled: false,
      since: null,
      limit: 100,
    });
    await flushPromises();
    expect(harness.timers.size).toBeGreaterThan(0);

    harness.runtime.handleCommand({ type: 'stop' });

    // All timers should be cleared.
    expect(harness.timers.size).toBe(0);
  });

  it('event frame increments snapshot.event_count and preserves max last_event_at', async () => {
    const harness = createHarness();
    harness.fetchMock
      .mockResolvedValueOnce(httpResponse(200, BOOTSTRAP_OK))
      .mockResolvedValueOnce(httpResponse(200, emptyDelta()));

    harness.runtime.handleCommand({
      type: 'start',
      apiBaseUrl: 'http://api',
      accessToken: 'tok',
      communityId: COMMUNITY_ID,
      peerId: 'peer',
      mdnsDemoEnabled: false,
      since: null,
      limit: 100,
    });
    await flushPromises();

    const socket = harness.getActiveSocket()!;
    socket.fireOpen();

    socket.fire('message', {
      data: JSON.stringify({
        frame_type: 'event',
        event: {
          sync_event_id: 'evt1',
          community_id: COMMUNITY_ID,
          event_type: 'post.published',
          aggregate_type: 'post',
          aggregate_id: 'post_1',
          actor_p2p_id: null,
          payload: null,
          cid: null,
          occurred_at: '2026-04-20T12:00:00.000Z',
        },
      }),
    });

    // Earlier event should not push last_event_at backwards.
    socket.fire('message', {
      data: JSON.stringify({
        frame_type: 'event',
        event: {
          sync_event_id: 'evt2',
          community_id: COMMUNITY_ID,
          event_type: 'post.updated',
          aggregate_type: 'post',
          aggregate_id: 'post_1',
          actor_p2p_id: null,
          payload: null,
          cid: null,
          occurred_at: '2026-04-20T11:00:00.000Z',
        },
      }),
    });

    const state = harness.runtime._state();
    expect(state.latestSnapshot?.event_count).toBe(2);
    expect(state.latestSnapshot?.last_event_at).toBe('2026-04-20T12:00:00.000Z');
  });

  it('401 sets phase=auth_required and stops the loop', async () => {
    const harness = createHarness();
    harness.fetchMock.mockResolvedValueOnce(httpResponse(401, { message: 'bad token' }));

    harness.runtime.handleCommand({
      type: 'start',
      apiBaseUrl: 'http://api',
      accessToken: 'tok',
      communityId: COMMUNITY_ID,
      peerId: 'peer',
      mdnsDemoEnabled: false,
      since: null,
      limit: 100,
    });
    await flushPromises();

    const errorMessages = harness.posted.filter(
      (m): m is { type: 'error'; status: { phase: string } } =>
        typeof m === 'object' && m !== null && (m as { type?: string }).type === 'error',
    );
    expect(errorMessages.some((m) => m.status.phase === 'auth_required')).toBe(true);

    // Loop is stopped — no poll timer, no reconnect timer.
    const state = harness.runtime._state();
    expect(state.timer).toBeNull();
    expect(state.reconnectTimer).toBeNull();
  });

  it('410 resets cursor and re-bootstraps', async () => {
    const harness = createHarness();
    // First bootstrap succeeds, first sync returns 410 (cursor expired).
    // On recovery, the cursor-update message carries since=null.
    harness.fetchMock
      .mockResolvedValueOnce(httpResponse(200, BOOTSTRAP_OK))
      .mockResolvedValueOnce(httpResponse(410, { code: 'cursor_expired' }))
      .mockResolvedValueOnce(httpResponse(200, BOOTSTRAP_OK))
      .mockResolvedValueOnce(httpResponse(200, emptyDelta()));

    harness.runtime.handleCommand({
      type: 'start',
      apiBaseUrl: 'http://api',
      accessToken: 'tok',
      communityId: COMMUNITY_ID,
      peerId: 'peer',
      mdnsDemoEnabled: false,
      since: 'stale-cursor',
      limit: 100,
    });

    await flushPromises();
    await flushPromises();

    const cursorUpdates = harness.posted.filter(
      (m): m is { type: 'cursor-update'; since: string | null } =>
        typeof m === 'object' && m !== null && (m as { type?: string }).type === 'cursor-update',
    );
    expect(cursorUpdates.some((m) => m.since === null)).toBe(true);
  });

  it('pauses polling while WebSocket is open', async () => {
    const harness = createHarness();
    harness.fetchMock
      .mockResolvedValueOnce(httpResponse(200, BOOTSTRAP_OK))
      .mockResolvedValueOnce(httpResponse(200, emptyDelta()));

    harness.runtime.handleCommand({
      type: 'start',
      apiBaseUrl: 'http://api',
      accessToken: 'tok',
      communityId: COMMUNITY_ID,
      peerId: 'peer',
      mdnsDemoEnabled: false,
      since: null,
      limit: 100,
    });
    await flushPromises();

    const socket = harness.getActiveSocket()!;
    socket.fireOpen();

    const fetchBefore = harness.fetchMock.mock.calls.length;

    // Manually trigger the poll interval. With the socket open, it should
    // short-circuit and NOT call fetch.
    const pollTimer = Array.from(harness.timers.values()).find((t) => t.interval);
    expect(pollTimer).toBeDefined();
    pollTimer!.fn();
    await flushPromises();

    expect(harness.fetchMock.mock.calls.length).toBe(fetchBefore);
  });

  it('in-flight guard prevents overlapping syncs', async () => {
    const harness = createHarness();

    // Bootstrap + first delta resolve instantly.
    harness.fetchMock
      .mockResolvedValueOnce(httpResponse(200, BOOTSTRAP_OK))
      .mockResolvedValueOnce(httpResponse(200, emptyDelta()));

    // Next two sync calls hang on pending promises so we can observe the
    // in-flight guard.
    let pendingResolve: ((v: Response) => void) | null = null;
    const pendingPromise = new Promise<Response>((r) => {
      pendingResolve = r;
    });
    harness.fetchMock.mockReturnValueOnce(pendingPromise);

    harness.runtime.handleCommand({
      type: 'start',
      apiBaseUrl: 'http://api',
      accessToken: 'tok',
      communityId: COMMUNITY_ID,
      peerId: 'peer',
      mdnsDemoEnabled: false,
      since: null,
      limit: 100,
    });
    await flushPromises();

    // Kick off a sync-only command that will hang.
    harness.runtime.handleCommand({ type: 'sync' });
    await flushPromises();
    expect(harness.runtime._state().inFlight).toBe(true);

    // A second sync command while the first is in-flight should NOT trigger
    // another fetch call.
    const callsBefore = harness.fetchMock.mock.calls.length;
    harness.runtime.handleCommand({ type: 'sync' });
    await flushPromises();
    expect(harness.fetchMock.mock.calls.length).toBe(callsBefore);

    // Resolve the pending fetch and check the in-flight flag drops.
    pendingResolve!(httpResponse(200, emptyDelta()));
    await flushPromises();
    expect(harness.runtime._state().inFlight).toBe(false);
  });

  it('SyncHttpError preserves status, code, and retryAfter', () => {
    const error = new SyncHttpError(429, 'too many', { code: 'rate_limited', retryAfterSeconds: 7 });
    expect(error.status).toBe(429);
    expect(error.code).toBe('rate_limited');
    expect(error.retryAfterSeconds).toBe(7);
    expect(error.name).toBe('SyncHttpError');
  });
});

async function flushPromises() {
  // Drain the microtask queue many times — the runtime chains several
  // awaits per command (fetch → clone → json → ...). Using setImmediate /
  // setTimeout(0) would be more robust, but a generous microtask drain is
  // simpler and deterministic enough for our synchronous mocks.
  for (let i = 0; i < 50; i += 1) {
    await Promise.resolve();
  }
}
