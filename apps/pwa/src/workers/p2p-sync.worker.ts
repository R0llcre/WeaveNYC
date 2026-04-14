/// <reference lib="webworker" />

import { getCommunitySyncWebSocketUrl } from '@/lib/api';
import type {
  CommunityBootstrapResponse,
  CommunitySyncEvent,
  CommunitySyncDeltaResponse,
  P2PSyncPhase,
  P2PSyncStatus,
  P2PTransportLabel,
} from '@/lib/types';

declare const self: DedicatedWorkerGlobalScope;

type WorkerState = {
  apiBaseUrl: string;
  accessToken: string;
  communityId: string;
  peerId: string;
  mdnsDemoEnabled: boolean;
  since: string | null;
  limit: number;
  timer: number | null;
  reconnectTimer: number | null;
  socket: WebSocket | null;
  shuttingDown: boolean;
  peerCount: number;
  websocketUrl: string | null;
  latestSnapshot: CommunitySyncDeltaResponse['latest_snapshot'];
};

type ReadyFrame = {
  frame_type: 'ready';
  peer_count?: number;
  latest_snapshot?: CommunitySyncDeltaResponse['latest_snapshot'];
  transport?: P2PTransportLabel;
};

type HeartbeatFrame = {
  frame_type: 'heartbeat';
  occurred_at?: string;
};

type EventFrame = {
  frame_type: 'event';
  event?: CommunitySyncEvent;
};

type WorkerFrame = ReadyFrame | HeartbeatFrame | EventFrame;

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
  | {
      type: 'sync';
    }
  | {
      type: 'update-config';
      mdnsDemoEnabled: boolean;
    }
  | {
      type: 'stop';
    };

const defaultState: WorkerState = {
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
};

let currentState: WorkerState = { ...defaultState };

function clearLoop() {
  if (currentState.timer !== null) {
    self.clearInterval(currentState.timer);
    currentState.timer = null;
  }
}

function clearReconnectLoop() {
  if (currentState.reconnectTimer !== null) {
    self.clearTimeout(currentState.reconnectTimer);
    currentState.reconnectTimer = null;
  }
}

function closeSocket() {
  if (currentState.socket) {
    try {
      currentState.socket.close();
    } catch {
      // ignore socket close failures
    }
    currentState.socket = null;
  }
}

function transportLabel(): P2PTransportLabel {
  return currentState.mdnsDemoEnabled ? 'mdns-demo' : 'bootstrap';
}

function buildStatus(overrides: Partial<P2PSyncStatus> = {}): P2PSyncStatus {
  return {
    communityId: currentState.communityId,
    enabled: Boolean(currentState.communityId),
    mdnsDemoEnabled: currentState.mdnsDemoEnabled,
    phase: 'disabled',
    peerId: currentState.peerId || null,
    peerCount: currentState.peerCount,
    transportLabel: transportLabel(),
    lastSyncAt: null,
    latestSnapshot: currentState.latestSnapshot,
    lastError: null,
    ...overrides,
  };
}

function postStatus(phase: P2PSyncPhase, overrides: Partial<P2PSyncStatus> = {}) {
  self.postMessage({
    type: 'status',
    status: buildStatus({
      phase,
      ...overrides,
    }),
  });
}

function normalizeHeaders() {
  return {
    Authorization: `Bearer ${currentState.accessToken}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWorkerFrame(value: unknown): value is WorkerFrame {
  return isRecord(value) && typeof value.frame_type === 'string';
}

function bumpSnapshot(event: CommunitySyncEvent) {
  const currentCount = currentState.latestSnapshot?.event_count ?? 0;
  const lastEventAt = currentState.latestSnapshot?.last_event_at;

  currentState.latestSnapshot = {
    last_event_at:
      !lastEventAt || event.occurred_at.localeCompare(lastEventAt) >= 0 ? event.occurred_at : lastEventAt,
    event_count: currentCount + 1,
  };
}

function updateSince(nextSince: string | null) {
  if (!nextSince) {
    return;
  }

  currentState.since = nextSince;
}

function postSync(delta: CommunitySyncDeltaResponse) {
  self.postMessage({
    type: 'sync',
    status: buildStatus({
      phase: 'ready',
      peerCount: currentState.peerCount,
      lastSyncAt: delta.server_time,
      latestSnapshot: delta.latest_snapshot,
      lastError: null,
    }),
    delta,
  });
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${currentState.apiBaseUrl}${path}`, {
    cache: 'no-store',
    headers: normalizeHeaders(),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`HTTP ${response.status} ${message}`.trim());
  }

  return (await response.json()) as T;
}

function getPeerCount() {
  return 0;
}

async function bootstrapAndSync(options: { retryOnFailure?: boolean } = {}) {
  postStatus('connecting');

  try {
    const bootstrap = await fetchJson<CommunityBootstrapResponse>(
      `/v1/communities/${currentState.communityId}/bootstrap`,
    );

    currentState.latestSnapshot = bootstrap.latest_snapshot;
    currentState.peerCount = getPeerCount();
    currentState.websocketUrl = bootstrap.anchor_node?.websocket_url ?? bootstrap.relay_nodes[0]?.websocket_url ?? null;

    const delta = await fetchSyncDelta();
    if (delta) {
      postSync(delta);
    }
    connectSocket();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'P2P bootstrap failed';
    self.postMessage({
      type: 'error',
      status: buildStatus({
        phase: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'degraded',
        lastError: message,
      }),
      error: message,
    });
    if (options.retryOnFailure && !currentState.shuttingDown) {
      scheduleReconnect();
    }
  }
}

async function fetchSyncDelta() {
  const params = new URLSearchParams();
  if (currentState.since) {
    params.set('since', currentState.since);
  }
  params.set('limit', String(currentState.limit));

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const delta = await fetchJson<CommunitySyncDeltaResponse>(
    `/v1/communities/${currentState.communityId}/sync${suffix}`,
  );

  updateSince(delta.next_since);
  currentState.latestSnapshot = delta.latest_snapshot;
  return delta;
}

async function runSyncOnly() {
  try {
    const delta = await fetchSyncDelta();
    postSync(delta);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'P2P sync failed';
    self.postMessage({
      type: 'error',
      status: buildStatus({
        phase: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'degraded',
        lastError: message,
      }),
      error: message,
    });
  }
}

function startLoop() {
  clearLoop();
  currentState.timer = self.setInterval(() => {
    void runSyncOnly();
  }, 30_000);
}

function scheduleReconnect() {
  if (currentState.shuttingDown || currentState.reconnectTimer !== null || !currentState.communityId) {
    return;
  }

  currentState.reconnectTimer = self.setTimeout(() => {
    currentState.reconnectTimer = null;
    // Bootstrap mints short-lived websocket credentials, so reconnects must
    // refresh bootstrap state before opening a new socket.
    void bootstrapAndSync({ retryOnFailure: true });
  }, 5_000);
}

function connectSocket() {
  if (!currentState.websocketUrl || currentState.socket || currentState.shuttingDown) {
    return;
  }

  let websocketUrl: string;
  try {
    websocketUrl = getCommunitySyncWebSocketUrl(
      currentState.websocketUrl,
      currentState.accessToken,
      currentState.communityId,
    );
  } catch {
    return;
  }

  try {
    const socket = new WebSocket(websocketUrl);
    currentState.socket = socket;

    socket.addEventListener('open', () => {
      postStatus('connecting', {
        lastError: null,
      });
    });

    socket.addEventListener('message', (event) => {
      if (currentState.socket !== socket) {
        return;
      }

      let frame: unknown;
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (!isWorkerFrame(frame)) {
        return;
      }

      if (frame.frame_type === 'ready') {
        currentState.peerCount =
          typeof frame.peer_count === 'number' ? frame.peer_count : currentState.peerCount;
        currentState.latestSnapshot = frame.latest_snapshot ?? currentState.latestSnapshot;
        postStatus('ready', {
          peerCount: currentState.peerCount,
          lastSyncAt: new Date().toISOString(),
          latestSnapshot: currentState.latestSnapshot,
          transportLabel: transportLabel(),
          lastError: null,
        });
        return;
      }

      if (frame.frame_type === 'heartbeat') {
        postStatus('ready', {
          lastSyncAt: frame.occurred_at ?? new Date().toISOString(),
          latestSnapshot: currentState.latestSnapshot,
          lastError: null,
        });
        return;
      }

      if (!frame.event) {
        return;
      }

      bumpSnapshot(frame.event);
      postSync({
        events: [frame.event],
        next_since: currentState.since,
        server_time: frame.event.occurred_at,
        latest_snapshot: currentState.latestSnapshot,
      });
    });

    socket.addEventListener('close', () => {
      const isCurrentSocket = currentState.socket === socket;
      if (isCurrentSocket) {
        currentState.socket = null;
      }
      if (!isCurrentSocket) {
        return;
      }
      if (currentState.shuttingDown) {
        return;
      }

      currentState.peerCount = 0;

      postStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'degraded', {
        peerCount: 0,
        latestSnapshot: currentState.latestSnapshot,
        lastError: 'Live sync disconnected. Falling back to catch-up polling.',
        transportLabel: transportLabel(),
      });
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      if (currentState.socket !== socket) {
        return;
      }

      try {
        socket.close();
      } catch {
        // ignore close errors from broken sockets
      }
    });
  } catch {
    scheduleReconnect();
  }
}

self.addEventListener('message', (event: MessageEvent<Command>) => {
  const command = event.data;

  if (command.type === 'stop') {
    currentState.shuttingDown = true;
    clearLoop();
    clearReconnectLoop();
    closeSocket();
    currentState = { ...defaultState };
    postStatus('disabled', {
      enabled: false,
      communityId: '',
      peerId: null,
    });
    return;
  }

  if (command.type === 'update-config') {
    currentState.mdnsDemoEnabled = command.mdnsDemoEnabled;
    postStatus(currentState.socket ? 'ready' : 'connecting', {
      transportLabel: transportLabel(),
    });
    return;
  }

  if (command.type === 'sync') {
    if (!currentState.communityId) {
      postStatus('disabled', {
        enabled: false,
      });
      return;
    }

    void runSyncOnly();
    return;
  }

  currentState.shuttingDown = true;
  clearReconnectLoop();
  closeSocket();
  currentState = {
    ...defaultState,
    apiBaseUrl: command.apiBaseUrl,
    accessToken: command.accessToken,
    communityId: command.communityId,
    peerId: command.peerId,
    mdnsDemoEnabled: command.mdnsDemoEnabled,
    since: command.since,
    limit: command.limit,
    shuttingDown: false,
  };

  startLoop();
  void bootstrapAndSync();
});
