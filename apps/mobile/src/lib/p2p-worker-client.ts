/**
 * M2 STUB — the PWA's P2P worker client wraps a DedicatedWorker that
 * does the libp2p sync work on a background thread
 * (`apps/pwa/src/workers/p2p-sync.worker.ts`). Web Workers don't exist
 * in React Native; the mobile P2P story in M6 will run the same sync
 * loop on a `setInterval` inside a long-running foreground task (or,
 * on Android, a `HeadlessJS` service) rather than in a Worker.
 *
 * This stub exposes the same type shape so `@/lib/hooks` can `import`
 * from it. The factory always returns `null`, which `useCommunityP2PSync`
 * already handles by falling back to a `'degraded'` status with a
 * user-visible error — that's the intended mobile runtime behaviour
 * until M6 wires the real client.
 *
 * DO NOT implement P2P logic here — M6 owns it.
 */

import type {
  CommunitySyncDeltaResponse,
  P2PSyncErrorCategory,
  P2PSyncStatus,
} from '@/lib/types';

export type WorkerErrorMeta = {
  requestId?: string;
  errorCategory?: P2PSyncErrorCategory;
  statusCode?: number;
};

type WorkerStartInput = {
  apiBaseUrl: string;
  accessToken: string;
  communityId: string;
  peerId: string;
  mdnsDemoEnabled: boolean;
  since: string | null;
  limit: number;
};

type BrowserP2PWorkerClientOptions = {
  onStatus: (status: P2PSyncStatus) => void;
  onSync: (status: P2PSyncStatus, delta: CommunitySyncDeltaResponse | null) => void;
  onError: (status: P2PSyncStatus, error: string, meta?: WorkerErrorMeta) => void;
  onCursorUpdate?: (update: { communityId: string; since: string | null; updatedAt: string }) => void;
};

export type BrowserP2PWorkerClient = {
  start: (input: WorkerStartInput) => void;
  sync: () => void;
  updateConfig: (mdnsDemoEnabled: boolean) => void;
  dispose: () => void;
};

/**
 * Always returns null on mobile until M6. `useCommunityP2PSync` already
 * handles the null case by emitting a `'degraded'` status with a
 * "Web Workers unavailable" message; on mobile the message will be
 * rephrased by the M6 wiring, but the null-check flow is already right.
 */
export function createBrowserP2PWorkerClient(
  _options: BrowserP2PWorkerClientOptions,
): BrowserP2PWorkerClient | null {
  void _options;
  return null;
}
