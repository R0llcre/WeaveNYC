'use client';

import type {
  CommunitySyncDeltaResponse,
  P2PSyncErrorCategory,
  P2PSyncStatus,
} from '@/lib/types';
import { captureClientException } from '@/lib/sentry-client';

type WorkerStatusMessage = {
  type: 'status';
  status: P2PSyncStatus;
};

type WorkerSyncMessage = {
  type: 'sync';
  status: P2PSyncStatus;
  delta: CommunitySyncDeltaResponse | null;
};

/**
 * Extended error message from the worker. `requestId`, `errorCategory`, and
 * `status_code` are optional so old-format messages still parse — but the new
 * worker always populates them, which gives us richer Sentry tagging and lets
 * the UI branch on auth vs network vs server errors.
 */
type WorkerErrorMessage = {
  type: 'error';
  status: P2PSyncStatus;
  error: string;
  requestId?: string;
  errorCategory?: P2PSyncErrorCategory;
  status_code?: number;
};

/**
 * Cursor save requests come out as their own message so we can route them
 * through the main thread's persistence layer (the main thread owns the
 * IndexedDB handle). The worker never touches Dexie directly.
 */
type WorkerCursorUpdateMessage = {
  type: 'cursor-update';
  communityId: string;
  since: string | null;
  updatedAt: string;
};

type WorkerMessage =
  | WorkerStatusMessage
  | WorkerSyncMessage
  | WorkerErrorMessage
  | WorkerCursorUpdateMessage;

type WorkerStartCommand = {
  type: 'start';
  apiBaseUrl: string;
  accessToken: string;
  communityId: string;
  peerId: string;
  mdnsDemoEnabled: boolean;
  since: string | null;
  limit: number;
};

type WorkerSyncCommand = { type: 'sync' };
type WorkerConfigCommand = { type: 'update-config'; mdnsDemoEnabled: boolean };
type WorkerStopCommand = { type: 'stop' };

type WorkerCommand =
  | WorkerStartCommand
  | WorkerSyncCommand
  | WorkerConfigCommand
  | WorkerStopCommand;

export type WorkerErrorMeta = {
  requestId?: string;
  errorCategory?: P2PSyncErrorCategory;
  statusCode?: number;
};

type BrowserP2PWorkerClientOptions = {
  onStatus: (status: P2PSyncStatus) => void;
  onSync: (status: P2PSyncStatus, delta: CommunitySyncDeltaResponse | null) => void;
  onError: (status: P2PSyncStatus, error: string, meta?: WorkerErrorMeta) => void;
  onCursorUpdate?: (update: { communityId: string; since: string | null; updatedAt: string }) => void;
};

export type BrowserP2PWorkerClient = {
  start: (input: Omit<WorkerStartCommand, 'type'>) => void;
  sync: () => void;
  updateConfig: (mdnsDemoEnabled: boolean) => void;
  dispose: () => void;
};

const MAX_WORKER_RESTARTS = 3;

function isWorkerMessage(value: unknown): value is WorkerMessage {
  return typeof value === 'object' && value !== null && 'type' in value;
}

/**
 * Public-path worker URL. We resolve it via `new URL('...', import.meta.url)`
 * so Next / Turbopack can thread it through their bundler-aware worker loader.
 */
function createWorker(): Worker {
  return new Worker(new URL('../workers/p2p-sync.worker.ts', import.meta.url), {
    type: 'module',
    name: 'weavenyc-p2p-sync',
  });
}

/**
 * Browser-side proxy to the DedicatedWorker running `p2p-sync.worker.ts`. Owns:
 *   - worker lifecycle + a bounded auto-restart policy (MAX_WORKER_RESTARTS per
 *     session) so a single bad frame can't take the sync loop down permanently.
 *   - routing of the worker's error / messageerror events to Sentry plus the
 *     consumer's `onError`, including request_id tagging so we can correlate
 *     client failures with the server-side log line.
 */
export function createBrowserP2PWorkerClient(
  options: BrowserP2PWorkerClientOptions,
): BrowserP2PWorkerClient | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }

  let worker: Worker | null = createWorker();
  let restartCount = 0;
  let disposed = false;
  // Remember the last start command so a restart can pick up where we left off.
  let lastStartCommand: WorkerStartCommand | null = null;

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (!isWorkerMessage(event.data)) {
      return;
    }

    if (event.data.type === 'status') {
      options.onStatus(event.data.status);
      return;
    }

    if (event.data.type === 'sync') {
      options.onSync(event.data.status, event.data.delta);
      return;
    }

    if (event.data.type === 'cursor-update') {
      options.onCursorUpdate?.({
        communityId: event.data.communityId,
        since: event.data.since,
        updatedAt: event.data.updatedAt,
      });
      return;
    }

    // type === 'error' — fan out to Sentry and the consumer, including the
    // request_id so the client breadcrumb lines up with the server log line.
    const meta: WorkerErrorMeta = {
      requestId: event.data.requestId,
      errorCategory: event.data.errorCategory,
      statusCode: event.data.status_code,
    };
    captureClientException(new Error(event.data.error), {
      tags: {
        area: 'p2p-worker',
        errorCategory: meta.errorCategory ?? 'unknown',
        statusCode: meta.statusCode !== undefined ? String(meta.statusCode) : undefined,
        requestId: meta.requestId,
      },
    });
    options.onError(event.data.status, event.data.error, meta);
  };

  function attachWorkerListeners() {
    if (!worker) return;
    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', (event: Event) => handleFatalError('error', event));
    worker.addEventListener('messageerror', (event: Event) => handleFatalError('messageerror', event));
  }

  /**
   * Fatal worker errors (`error` / `messageerror`). We bounce the worker up to
   * MAX_WORKER_RESTARTS times so a transient parse failure doesn't leave the
   * app in a stuck state. Past the cap we give up and leave the client
   * hollowed out — the UI already shows "degraded" via the previous status.
   */
  function handleFatalError(kind: 'error' | 'messageerror', event: Event) {
    const native =
      event instanceof ErrorEvent && event.error instanceof Error
        ? event.error
        : new Error(event instanceof ErrorEvent ? event.message : `Worker ${kind}`);
    captureClientException(native, {
      tags: { area: 'p2p-worker', kind },
    });
    options.onError(
      {
        communityId: lastStartCommand?.communityId ?? '',
        enabled: Boolean(lastStartCommand?.communityId),
        mdnsDemoEnabled: lastStartCommand?.mdnsDemoEnabled ?? false,
        phase: 'degraded',
        peerId: lastStartCommand?.peerId ?? null,
        peerCount: 0,
        transportLabel: 'bootstrap',
        lastSyncAt: null,
        latestSnapshot: null,
        lastError: native.message,
        errorCategory: 'unknown',
      },
      native.message,
      { errorCategory: 'unknown' },
    );

    if (disposed) {
      return;
    }

    if (restartCount >= MAX_WORKER_RESTARTS) {
      return;
    }

    restartCount += 1;
    try {
      worker?.removeEventListener('message', handleMessage);
      worker?.terminate();
    } catch {
      // ignore
    }

    worker = createWorker();
    attachWorkerListeners();
    if (lastStartCommand) {
      worker.postMessage(lastStartCommand);
    }
  }

  attachWorkerListeners();

  const postCommand = (command: WorkerCommand) => {
    if (!worker) {
      return;
    }
    if (command.type === 'start') {
      lastStartCommand = command;
    }
    worker.postMessage(command);
  };

  return {
    start(input) {
      postCommand({ type: 'start', ...input });
    },
    sync() {
      postCommand({ type: 'sync' });
    },
    updateConfig(mdnsDemoEnabled) {
      postCommand({ type: 'update-config', mdnsDemoEnabled });
    },
    dispose() {
      disposed = true;
      postCommand({ type: 'stop' });
      worker?.removeEventListener('message', handleMessage);
      worker?.terminate();
      worker = null;
    },
  };
}
