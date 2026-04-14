'use client';

import type { CommunitySyncDeltaResponse, P2PSyncStatus } from '@/lib/types';

type WorkerStatusMessage = {
  type: 'status';
  status: P2PSyncStatus;
};

type WorkerSyncMessage = {
  type: 'sync';
  status: P2PSyncStatus;
  delta: CommunitySyncDeltaResponse | null;
};

type WorkerErrorMessage = {
  type: 'error';
  status: P2PSyncStatus;
  error: string;
};

type WorkerMessage = WorkerStatusMessage | WorkerSyncMessage | WorkerErrorMessage;

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

type WorkerSyncCommand = {
  type: 'sync';
};

type WorkerConfigCommand = {
  type: 'update-config';
  mdnsDemoEnabled: boolean;
};

type WorkerStopCommand = {
  type: 'stop';
};

type WorkerCommand = WorkerStartCommand | WorkerSyncCommand | WorkerConfigCommand | WorkerStopCommand;

type BrowserP2PWorkerClientOptions = {
  onStatus: (status: P2PSyncStatus) => void;
  onSync: (status: P2PSyncStatus, delta: CommunitySyncDeltaResponse | null) => void;
  onError: (status: P2PSyncStatus, error: string) => void;
};

export type BrowserP2PWorkerClient = {
  start: (input: Omit<WorkerStartCommand, 'type'>) => void;
  sync: () => void;
  updateConfig: (mdnsDemoEnabled: boolean) => void;
  dispose: () => void;
};

function isWorkerMessage(value: unknown): value is WorkerMessage {
  return typeof value === 'object' && value !== null && 'type' in value;
}

export function createBrowserP2PWorkerClient(options: BrowserP2PWorkerClientOptions): BrowserP2PWorkerClient | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }

  const worker = new Worker(new URL('../workers/p2p-sync.worker.ts', import.meta.url), {
    type: 'module',
    name: 'weavenyc-p2p-sync',
  });

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

    options.onError(event.data.status, event.data.error);
  };

  worker.addEventListener('message', handleMessage);

  const postCommand = (command: WorkerCommand) => {
    worker.postMessage(command);
  };

  return {
    start(input) {
      postCommand({
        type: 'start',
        ...input,
      });
    },
    sync() {
      postCommand({
        type: 'sync',
      });
    },
    updateConfig(mdnsDemoEnabled) {
      postCommand({
        type: 'update-config',
        mdnsDemoEnabled,
      });
    },
    dispose() {
      worker.removeEventListener('message', handleMessage);
      postCommand({
        type: 'stop',
      });
      worker.terminate();
    },
  };
}
