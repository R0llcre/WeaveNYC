'use client';

import { useEffect, useRef } from 'react';

import { getChatWebSocketUrl } from '@/lib/api';
import type { ChatRealtimeEvent } from '@/lib/types';

export type ChatWebSocketState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export type UseChatWebSocketOptions = {
  enabled: boolean;
  onStateChange?: (state: ChatWebSocketState) => void;
  /**
   * Fires after a socket reopens following a prior disconnect. Consumers
   * should refetch any server-driven state here — the server buffer for the
   * offline window is not replayed, so the client must pull missed
   * messages / conversation updates explicitly. Does NOT fire on the very
   * first connect of the hook lifecycle. Defensive: invoked at most once
   * per successful post-disconnect reconnect.
   */
  onReconnect?: () => void;
};

// Tunables for the reconnect loop. P0-2:
//   - MAX_ATTEMPTS raised from 5 → 20 so a subway commuter losing signal
//     across multiple stations still converges back to a live socket.
//   - MAX_DELAY capped at 30s — the exponential curve flattens here instead
//     of growing unbounded, so the reconnect stays responsive.
//   - JITTER_RATIO of 0.3 adds ±30% randomness to avoid a thundering herd
//     if the gateway restarts and every client reconnects on the same beat.
const MAX_ATTEMPTS = 20;
const MAX_DELAY_MS = 30_000;
const BASE_DELAY_MS = 1_000;
const JITTER_RATIO = 0.3;

function computeBackoff(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  // Symmetric jitter: [(1 - r), (1 + r)] × exponential.
  const jitter = exponential * JITTER_RATIO * (Math.random() * 2 - 1);
  const withJitter = exponential + jitter;
  // Never go below half the base (200ms floor) — otherwise a tight retry
  // loop could hammer the gateway on the first failure.
  return Math.max(200, withJitter);
}

/**
 * Maintains a resilient chat WebSocket with exponential reconnect + heartbeat.
 *
 * Bug F5-1 fix: previous implementation opened a single socket with no error
 * handler, heartbeat, or reconnect. This hook wraps the raw `WebSocket` so that
 * transient drops (e.g. backgrounded tab, mobile handover, gateway restart) are
 * transparently recovered until the component unmounts or `options.enabled`
 * flips to false.
 *
 * P0-2 additions: the reconnect cap was raised to 20 attempts with jittered
 * exponential backoff (≤30s), the browser `'online'` event resets the
 * attempt counter and triggers an immediate connect, and callers can pass
 * an `onReconnect` callback to refetch server-side state after a
 * post-disconnect re-open (the server does not replay the offline
 * message backlog).
 *
 * The hook keeps the `onMessage` and `onStateChange` callbacks in refs so the
 * caller does not need to memoize them - the effect only re-runs when the
 * access token or the enabled flag changes.
 */
export function useChatWebSocket(
  accessToken: string | undefined,
  onMessage: (event: ChatRealtimeEvent) => void,
  options: UseChatWebSocketOptions,
) {
  const onMessageRef = useRef(onMessage);
  const onStateChangeRef = useRef(options.onStateChange);
  const onReconnectRef = useRef(options.onReconnect);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onStateChangeRef.current = options.onStateChange;
  }, [options.onStateChange]);

  useEffect(() => {
    onReconnectRef.current = options.onReconnect;
  }, [options.onReconnect]);

  useEffect(() => {
    if (!options.enabled || !accessToken) {
      onStateChangeRef.current?.('closed');
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectAttempts = 0;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    // Tracks whether this hook has ever observed a disconnect since mount.
    // The very first 'open' is the initial connect (no refetch needed);
    // every subsequent 'open' is a recovery and should fire `onReconnect`.
    let hadPriorDisconnect = false;

    const clearTimers = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    const scheduleReconnect = () => {
      if (!active) return;
      if (reconnectAttempts >= MAX_ATTEMPTS) {
        onStateChangeRef.current?.('closed');
        return;
      }
      reconnectAttempts += 1;
      onStateChangeRef.current?.('reconnecting');
      const delay = computeBackoff(reconnectAttempts);
      reconnectTimeout = setTimeout(connect, delay);
    };

    const connect = () => {
      if (!active) return;

      onStateChangeRef.current?.(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

      try {
        socket = new WebSocket(getChatWebSocketUrl(accessToken));
      } catch {
        // URL construction or constructor can throw on invalid tokens during
        // hot-reload; schedule another attempt.
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        const isReconnect = hadPriorDisconnect;
        reconnectAttempts = 0;
        onStateChangeRef.current?.('open');
        heartbeatInterval = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            try {
              socket.send(JSON.stringify({ type: 'ping' }));
            } catch {
              // Ignore send errors; the next close event will drive a reconnect.
            }
          }
        }, 30_000);
        if (isReconnect) {
          // Reset the flag so a single reconnect fires the callback once.
          hadPriorDisconnect = false;
          try {
            onReconnectRef.current?.();
          } catch {
            // Consumer-provided callback errors must not kill the socket
            // loop; swallow and keep the heartbeat running.
          }
        }
      };

      socket.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as ChatRealtimeEvent;
          onMessageRef.current(payload);
        } catch {
          // Malformed payloads are ignored rather than killing the socket.
        }
      };

      socket.onerror = () => {
        // Let onclose drive the reconnect flow to avoid double-scheduling.
      };

      socket.onclose = () => {
        // Any close after the initial open is a disconnect; the next
        // successful open should be treated as a recovery.
        hadPriorDisconnect = true;
        clearTimers();
        scheduleReconnect();
      };
    };

    // P0-2: an `online` event from the OS/browser is the strongest signal
    // that a network transition just completed (e.g. Wi-Fi handover,
    // subway → cell, airplane-mode flip). Reset the attempt counter and
    // force a reconnect if the socket isn't already open. Bound to
    // `window` because Node/SSR obviously won't fire the event; guarded
    // so server-side rendering is a no-op.
    const handleOnline = () => {
      if (!active) return;
      if (socket?.readyState === WebSocket.OPEN) return;
      reconnectAttempts = 0;
      clearTimers();
      connect();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    connect();

    return () => {
      active = false;
      clearTimers();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        try {
          socket.close();
        } catch {
          // Ignore close errors during teardown.
        }
      }
      onStateChangeRef.current?.('closed');
    };
  }, [accessToken, options.enabled]);
}
