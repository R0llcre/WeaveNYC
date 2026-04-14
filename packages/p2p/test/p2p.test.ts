import { describe, expect, it } from "vitest";

import type { CommunitySyncEvent } from "@weavenyc/shared";

import {
  attachEventEnvelopeSignature,
  canonicalizeJson,
  compareVersionedContent,
  dedupeSyncEvents,
  encodeDagNode,
  mergeSyncEventBatches,
  mergeVersionedContent,
  sortSyncEventsForReplay,
  verifyEventEnvelopeSignature,
} from "../src/index.js";

const postPayload = {
  post_id: "77777777-7777-4777-8777-777777777777",
  community_id: "44444444-4444-4444-8444-444444444444",
  post_type: "request" as const,
  category: "food" as const,
  title: "Need groceries",
  body: "Need groceries for the next two days.",
  language: "en" as const,
  location_zip: "11735",
  privacy: "community_only" as const,
  status: "active" as const,
  risk_level: "low" as const,
  created_at: "2026-04-13T12:00:00.000Z",
  updated_at: "2026-04-13T12:00:00.000Z",
  expires_at: "2026-04-14T12:00:00.000Z",
  is_owner: false,
  p2p_version: 1,
  ipfs_cid: null,
};

const baseEvent: CommunitySyncEvent = {
  sync_event_id: "88888888-8888-4888-8888-888888888888",
  community_id: "44444444-4444-4444-8444-444444444444",
  topic: "weavenyc/demo/posts",
  event_type: "post.published",
  aggregate_type: "post",
  aggregate_id: postPayload.post_id,
  occurred_at: "2026-04-13T12:00:00.000Z",
  actor_p2p_id: "edge-a",
  cid: null,
  payload: {
    post: postPayload,
  },
  signature: null,
};

describe("@weavenyc/p2p", () => {
  it("canonicalizes object keys deterministically", () => {
    expect(
      canonicalizeJson({
        z: 1,
        a: {
          c: 2,
          b: 1,
        },
      }),
    ).toBe('{"a":{"b":1,"c":2},"z":1}');
  });

  it("encodes stable DAG CIDs for identical payloads", async () => {
    const first = await encodeDagNode({
      ...postPayload,
      metadata: {
        z: 2,
        a: 1,
      },
    });
    const second = await encodeDagNode({
      ...postPayload,
      metadata: {
        a: 1,
        z: 2,
      },
    });

    expect(first.cid).toBe(second.cid);
    expect(first.bytes.length).toBeGreaterThan(0);
  });

  it("signs and verifies event envelopes", async () => {
    const signed = await attachEventEnvelopeSignature(baseEvent, "demo-shared-secret");

    expect(signed.signature).toBeTruthy();
    await expect(verifyEventEnvelopeSignature(signed, "demo-shared-secret")).resolves.toBe(true);
    await expect(verifyEventEnvelopeSignature(signed, "wrong-secret")).resolves.toBe(false);
  });

  it("merges versioned content by p2p version then updated_at", () => {
    const current = {
      p2p_version: 1,
      updated_at: "2026-04-13T12:00:00.000Z",
    };
    const incoming = {
      p2p_version: 2,
      updated_at: "2026-04-13T11:00:00.000Z",
    };

    expect(compareVersionedContent(current, incoming)).toBeLessThan(0);
    expect(mergeVersionedContent(current, incoming)).toEqual(incoming);
  });

  it("sorts and dedupes replay batches", () => {
    const laterEvent: CommunitySyncEvent = {
      ...baseEvent,
      sync_event_id: "99999999-9999-4999-8999-999999999999",
      occurred_at: "2026-04-13T12:01:00.000Z",
      event_type: "post.updated",
      payload: {
        post: {
          ...postPayload,
          p2p_version: 2,
          updated_at: "2026-04-13T12:01:00.000Z",
        },
      },
    };
    const duplicateLaterEvent: CommunitySyncEvent = {
      ...laterEvent,
      signature: "duplicate-signature",
    };

    const sorted = sortSyncEventsForReplay([laterEvent, baseEvent]);
    const merged = mergeSyncEventBatches([baseEvent], [laterEvent, duplicateLaterEvent]);

    expect(sorted.map((event) => event.sync_event_id)).toEqual([
      baseEvent.sync_event_id,
      laterEvent.sync_event_id,
    ]);
    expect(dedupeSyncEvents([laterEvent, duplicateLaterEvent]).length).toBe(1);
    expect(merged.map((event) => event.sync_event_id)).toEqual([
      baseEvent.sync_event_id,
      laterEvent.sync_event_id,
    ]);
    expect(merged[1]?.signature).toBe("duplicate-signature");
  });
});
