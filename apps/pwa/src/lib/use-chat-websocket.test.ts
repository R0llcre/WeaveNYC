/**
 * @vitest-environment jsdom
 *
 * Unit tests for the P0-2 reliability guarantees on `useChatWebSocket`:
 *
 *   1. A 6th consecutive close event still schedules another reconnect (the
 *      old implementation gave up after 5 and left a subway commuter
 *      stranded). MAX_ATTEMPTS is 20, so 6 is well within the window.
 *   2. A browser `'online'` event resets the attempt counter and forces an
 *      immediate connect when the socket isn't already OPEN — the exact
 *      signal for Wi-Fi/cell handovers.
 *   3. `onReconnect` fires exactly once per post-disconnect re-open, and
 *      NOT on the initial connect (so the first mount doesn't double-fetch).
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

  close(_code?: number, _reason?: string) {
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
});
