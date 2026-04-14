import type { CommunitySyncEvent } from "@weavenyc/shared";

export type VersionedContent = {
  p2p_version: number;
  updated_at?: string;
};

function compareIsoOrEmpty(left?: string, right?: string) {
  return (left ?? "").localeCompare(right ?? "");
}

export function compareVersionedContent<T extends VersionedContent>(left: T, right: T) {
  if (left.p2p_version !== right.p2p_version) {
    return left.p2p_version - right.p2p_version;
  }

  return compareIsoOrEmpty(left.updated_at, right.updated_at);
}

export function mergeVersionedContent<T extends VersionedContent>(
  current: T | null | undefined,
  incoming: T,
) {
  if (!current) {
    return incoming;
  }

  return compareVersionedContent(current, incoming) >= 0 ? current : incoming;
}

export function sortSyncEventsForReplay(events: CommunitySyncEvent[]) {
  return [...events].sort((left, right) => {
    const occurredAtCompare = left.occurred_at.localeCompare(right.occurred_at);
    if (occurredAtCompare !== 0) {
      return occurredAtCompare;
    }

    return left.sync_event_id.localeCompare(right.sync_event_id);
  });
}

export function dedupeSyncEvents(events: CommunitySyncEvent[]) {
  const deduped = new Map<string, CommunitySyncEvent>();

  for (const event of sortSyncEventsForReplay(events)) {
    deduped.set(event.sync_event_id, event);
  }

  return [...deduped.values()];
}

export function mergeSyncEventBatches(current: CommunitySyncEvent[], incoming: CommunitySyncEvent[]) {
  return dedupeSyncEvents([...current, ...incoming]);
}
