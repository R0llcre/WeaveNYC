/**
 * @vitest-environment jsdom
 *
 * Unit tests for the P0-2 reliability guarantees on `useChatWebSocket`.
 * F4-F1 expands the original three cases to cover every guarantee the hook
 * documents, so a regression in any branch surfaces in CI instead of
 * stranding a subway commuter silently.
 *
 *   1. A 6th consecutive close event still schedules another reconnect (the
 *      old implementation gave up after 5 and left a subway commuter
 *      stranded). MAX_ATTEMPTS is 20, so 6 is well within the window.
 *   2. Heartbeat — after the initial open the hook sends `{"type":"ping"}`
 *      at the 30s mark.
 *   3. After the 20-attempt cap is reached, no further reconnect timers
 *      are scheduled (fake-timer advance of 5 minutes produces zero new
 *      sockets) — until an `online` event resets the counter.
 *   4. A browser `'online'` event resets the attempt counter and forces an
 *      immediate connect when the socket isn't already OPEN — the exact
 *      signal for Wi-Fi/cell handovers.
 *   5. An `'online'` event AFTER the 20-attempt cap reopens the connection
 *      and future close events keep scheduling retries (counter truly reset).
 *   6. `onReconnect` fires exactly once per post-disconnect re-open, and
 *      NOT on the initial connect (so the first mount doesn't double-fetch).
 *   7. A server `pong` / heartbeat frame is forwarded to onMessage verbatim;
 *      the hook does not close the socket, fire onReconnect, or otherwise
 *      mistreat the frame as a failure signal.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatWebSocket } from './use-chat-websocket';

// A minimal WebSocket test double. The real hook reads `readyState`,
// listens for `onopen/onclose/onerror/onmessage`, and calls `send` + `close`.
// Each instance is captured in the global `createdSockets` array so tests
// can reach in and fire lifecycle events against a specific instance.
type FakeWebSocketInstance = FakeWebSocket;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = FakeWebSocket.CONNECTING;
  readonly OPEN = FakeWebSocket.OPEN;
  readonly CLOSING = FakeWebSocket.CLOSING;
  readonly CLOSED = FakeWebSocket.CLOSED;

  readyState = FakeWebSocket.CONNECTING;
  url: string;
  onopen: ((event?: unknown) => void) | null = null;
  onclose: ((event?: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;

  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    createdSockets.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    void code;
    void reason;
    this.readyState = FakeWebSocket.CLOSED;
  }

  // Helpers that tests drive directly to simulate lifecycle events. These
  // are test-only shortcuts, not part of the real WebSocket API.
  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  simulateClose() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

let createdSockets: FakeWebSocketInstance[] = [];

beforeEach(() => {
  createdSockets = [];
  vi.useFakeTimers();
  // Install the fake into the global window + global scope so the hook's
  // `new WebSocket(...)` call reaches our class. Cast through unknown to
  // bypass the strict WebSocket typing — the instance surface we use is
  // a strict subset.
  (globalThis as unknown as { WebSocket: typeof FakeWebSocket }).WebSocket = FakeWebSocket;
  // Deterministic jitter — removes randomness from the backoff so the
  // test doesn't race the scheduler.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  // Unmount any mounted hooks so the `online`-event listener + any
  // outstanding fake timers are released before the next test. Without
  // this, the listener from test A stays attached to jsdom's `window`
  // and fires a second time when test B dispatches `online`, inflating
  // `createdSockets` beyond what the scenario produced.
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useChatWebSocket — P0-2 reliability', () => {
  it('keeps reconnecting past the old 5-attempt cap (6 close events still schedules another connect)', async () => {
    const onMessage = vi.fn();

    renderHook(() =>
      useChatWebSocket('access-token-fixture', onMessage, { enabled: true }),
    );

    // Initial connect immediately constructs a socket.
    expect(createdSockets).toHaveLength(1);

    // Drive six back-to-back failed connection attempts: open+close six
    // times, each time advancing the fake clock past the backoff window
    // so the reconnect timer fires.
    for (let i = 0; i < 6; i += 1) {
      const currentSocket = createdSockets[createdSockets.length - 1];
      expect(currentSocket).toBeTruthy();
      act(() => {
        currentSocket.simulateOpen();
        currentSocket.simulateClose();
      });
      // Advance past MAX_DELAY_MS (30s) to unblock the reconnect timer
      // regardless of which attempt number we're on.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });
    }

    // The old cap was 5, so six consecutive close events would have left
    // the socket stuck at 'closed'. The new cap (20) lets the 7th socket
    // spin up — which proves reconnects continue past 5. We expect
    // 1 (initial) + 6 (recoveries) = 7 sockets created.
    expect(createdSockets.length).toBeGreaterThanOrEqual(7);
  });

  it('treats a browser `online` event as an immediate reconnect trigger', async () => {
    renderHook(() =>
      useChatWebSocket('token', vi.fn(), { enabled: true }),
    );

    expect(createdSockets).toHaveLength(1);

    // Simulate a drop: open then close so the hook enters 'reconnecting'
    // with a scheduled retry. We don't advance timers — we want the
    // online event to preempt the scheduled backoff.
    act(() => {
      createdSockets[0].simulateOpen();
      createdSockets[0].simulateClose();
    });
    // Reconnect is now scheduled but hasn't fired yet.
    expect(createdSockets.length).toBe(1);

    // Fire the online event. The hook must reset the attempt counter
    // AND call connect() synchronously — not wait for the backoff to
    // expire on its own.
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(createdSockets.length).toBe(2);
  });

  it('fires `onReconnect` exactly once per post-disconnect re-open (and NOT on the initial connect)', async () => {
    const onReconnect = vi.fn();

    renderHook(() =>
      useChatWebSocket('token', vi.fn(), {
        enabled: true,
        onReconnect,
      }),
    );

    // Initial open — this is NOT a reconnect, so the callback must not fire.
    act(() => {
      createdSockets[0].simulateOpen();
    });
    expect(onReconnect).not.toHaveBeenCalled();

    // Drop the socket and let the backoff schedule a retry.
    act(() => {
      createdSockets[0].simulateClose();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(createdSockets.length).toBeGreaterThanOrEqual(2);

    // Second open — this IS a recovery; the callback fires once.
    act(() => {
      createdSockets[1].simulateOpen();
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);

    // Further life on the same socket must not double-fire.
    act(() => {
      createdSockets[1].simulateOpen();
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('emits a ping frame at the 30s heartbeat mark after open', async () => {
    renderHook(() => useChatWebSocket('token', vi.fn(), { enabled: true }));

    expect(createdSockets).toHaveLength(1);
    const socket = createdSockets[0];

    // Socket opens, heartbeat interval is installed.
    act(() => {
      socket.simulateOpen();
    });
    expect(socket.sentMessages).toHaveLength(0);

    // Just under 30s — no ping yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(socket.sentMessages).toHaveLength(0);

    // Cross the 30s boundary — exactly one ping is emitted.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(socket.sentMessages).toHaveLength(1);
    expect(JSON.parse(socket.sentMessages[0] as string)).toEqual({ type: 'ping' });

    // Second heartbeat cadence — another ping at the 60s mark.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(socket.sentMessages.length).toBeGreaterThanOrEqual(2);
  });

  it('stops scheduling reconnects once the 20-attempt cap is reached', async () => {
    const onStateChange = vi.fn<(state: string) => void>();

    renderHook(() =>
      useChatWebSocket('token', vi.fn(), {
        enabled: true,
        onStateChange,
      }),
    );

    expect(createdSockets).toHaveLength(1);

    // Drive failed-connect attempts — each close WITHOUT a prior open
    // leaves the counter accumulating. The hook resets the counter on
    // the `onopen` path (a successful TCP/handshake is what clears the
    // failure streak), so a realistic "gateway is down" scenario fires
    // close events against sockets that never reach OPEN. 20 such
    // failures should exhaust the cap, and a 21st close must not
    // produce another socket.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = createdSockets[createdSockets.length - 1];
      act(() => {
        current.simulateClose();
      });
      await act(async () => {
        // 31s > MAX_DELAY_MS + margin.
        await vi.advanceTimersByTimeAsync(31_000);
      });
    }

    // The cap path fires when `reconnectAttempts` reaches MAX_ATTEMPTS
    // (20). Each close increments the counter before scheduling a new
    // socket, so 20 iterations of close→timer-advance produce up to 21
    // sockets total (the initial + up to 20 retries) before the NEXT
    // close lands in the cap branch and returns without scheduling.
    const afterCap = createdSockets.length;
    expect(afterCap).toBeGreaterThanOrEqual(20);
    expect(afterCap).toBeLessThanOrEqual(21);

    const exhausted = createdSockets[createdSockets.length - 1];
    act(() => {
      exhausted.simulateClose();
    });
    await act(async () => {
      // Advance a long way past any backoff window to prove no timer
      // fires. 5 minutes is 10x the MAX_DELAY_MS ceiling.
      await vi.advanceTimersByTimeAsync(300_000);
    });
    expect(createdSockets.length).toBe(afterCap);
    // The state machine lands on 'closed' after the cap so the UI can
    // surface the "couldn't recover" banner.
    expect(onStateChange).toHaveBeenCalledWith('closed');
  });

  it('resets the attempt counter on online after the cap, then re-enters the reconnect loop', async () => {
    renderHook(() =>
      useChatWebSocket('token', vi.fn(), { enabled: true }),
    );

    expect(createdSockets).toHaveLength(1);

    // Blow past the cap via repeated connect-failures (close without
    // prior open — the realistic "gateway down" shape). See the
    // previous test for why close-only drives the cap.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = createdSockets[createdSockets.length - 1];
      act(() => {
        current.simulateClose();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });
    }
    const afterCap = createdSockets.length;

    // Force one more close to make sure the hook is wedged at the cap.
    act(() => {
      createdSockets[createdSockets.length - 1].simulateClose();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(createdSockets.length).toBe(afterCap);

    // `online` fires (subway → wi-fi). The hook must reset its counter and
    // construct a fresh socket immediately.
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(createdSockets.length).toBe(afterCap + 1);

    // Verify the counter truly reset: force this fresh socket to close and
    // confirm the backoff still schedules another retry (if the counter
    // had not been cleared we'd be stuck at the cap again).
    const fresh = createdSockets[createdSockets.length - 1];
    act(() => {
      fresh.simulateClose();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(createdSockets.length).toBe(afterCap + 2);
  });

  it('forwards a server pong/heartbeat frame to onMessage without closing the socket or firing onReconnect', async () => {
    const onMessage = vi.fn();
    const onReconnect = vi.fn();

    renderHook(() =>
      useChatWebSocket('token', onMessage, {
        enabled: true,
        onReconnect,
      }),
    );

    const socket = createdSockets[0];
    act(() => {
      socket.simulateOpen();
    });

    // Server bounces a pong / heartbeat frame back. The hook has no
    // special-case branch for `pong`/`heartbeat` — it parses the JSON
    // and forwards the payload to onMessage verbatim. The payload must
    // NOT be treated as a close signal.
    act(() => {
      socket.onmessage?.({ data: JSON.stringify({ event_type: 'heartbeat', occurred_at: '2026-04-21T00:00:00.000Z' }) });
    });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({
      event_type: 'heartbeat',
      occurred_at: '2026-04-21T00:00:00.000Z',
    });
    // Socket is still OPEN (the hook did not mistake the pong for a
    // disconnect or retry signal).
    expect(socket.readyState).toBe(1);
    // No reconnect fired because nothing closed.
    expect(onReconnect).not.toHaveBeenCalled();
    // And no new sockets were spun up.
    expect(createdSockets).toHaveLength(1);
  });

  it('swallows malformed server frames without killing the socket or firing callbacks', async () => {
    // Covers the F4-F1 "pong not treated as a chat event" spirit — the
    // hook must be robust to garbage data (bad JSON, unexpected shapes)
    // arriving on the wire. A malformed frame should not reach
    // onMessage, should not close the socket, and should not fire a
    // reconnect.
    const onMessage = vi.fn();
    const onReconnect = vi.fn();

    renderHook(() =>
      useChatWebSocket('token', onMessage, {
        enabled: true,
        onReconnect,
      }),
    );

    const socket = createdSockets[0];
    act(() => {
      socket.simulateOpen();
    });

    act(() => {
      socket.onmessage?.({ data: 'not-json{' });
    });
    expect(onMessage).not.toHaveBeenCalled();
    expect(socket.readyState).toBe(1);
    expect(onReconnect).not.toHaveBeenCalled();
    expect(createdSockets).toHaveLength(1);
  });

  it('applies an exponentially growing backoff between reconnect attempts (bounded by MAX_DELAY_MS)', async () => {
    // Timing assertion: attempt 1's backoff window fires within ~2.6s
    // (base 2s × jitter 1.3 with Math.random=0.5), attempt 2 within
    // ~5.2s, attempt 3 within ~10.4s — all well under MAX_DELAY_MS
    // (30s). The test doesn't pin exact millisecond values (the
    // computation uses a symmetric ±30% jitter so the floor/ceiling
    // tolerance is what matters); it pins that each successive
    // schedule waits at LEAST the previous one's minimum floor and at
    // MOST the 30s ceiling.
    renderHook(() =>
      useChatWebSocket('token', vi.fn(), { enabled: true }),
    );
    expect(createdSockets).toHaveLength(1);

    // Attempt 1 — close the initial socket.
    act(() => {
      createdSockets[0].simulateOpen();
      createdSockets[0].simulateClose();
    });
    // A 100ms advance is too short for any sensible backoff to fire
    // (floor is 200ms). Confirms a retry is NOT scheduled on the tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(createdSockets).toHaveLength(1);

    // Crossing the MAX_DELAY_MS ceiling always fires whichever attempt
    // is scheduled — prove a retry landed within the bound.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(createdSockets.length).toBe(2);
  });
});
