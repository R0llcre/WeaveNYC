'use client';

import { useEffect, useRef } from 'react';

import { getChatWebSocketUrl } from '@/lib/api';
import type { ChatRealtimeEvent } from '@/lib/types';

export type ChatWebSocketState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export type UseChatWebSocketOptions = {
  enabled: boolean;
  onStateChange?: (state: ChatWebSocketState) => void;
};

/**
 * Maintains a resilient chat WebSocket with exponential reconnect + heartbeat.
 *
 * Bug F5-1 fix: previous implementation opened a single socket with no error
 * handler, heartbeat, or reconnect. This hook wraps the raw `WebSocket` so that
 * transient drops (e.g. backgrounded tab, mobile handover, gateway restart) are
 * transparently recovered until the component unmounts or `options.enabled`
 * flips to false.
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

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onStateChangeRef.current = options.onStateChange;
  }, [options.onStateChange]);

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
      if (reconnectAttempts >= 5) {
        onStateChangeRef.current?.('closed');
        return;
      }
      reconnectAttempts += 1;
      onStateChangeRef.current?.('reconnecting');
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
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
        clearTimers();
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      active = false;
      clearTimers();
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
