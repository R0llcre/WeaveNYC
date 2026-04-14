import { describe, expect, it } from "vitest";

import {
  adminReportQueueResponseSchema,
  anonymousSessionRequestSchema,
  anonymousSessionResponseSchema,
  communityBootstrapResponseSchema,
  notificationEmailSendRequestSchema,
  notificationInternalJwtClaimsSchema,
  notificationSmsSendResponseSchema,
  jwtClaimsSchema,
  p2pEventEnvelopeSchema,
  reportCreateRequestSchema,
  resourceListResponseSchema
} from "./index";

describe("@weavenyc/shared validators", () => {
  it("accepts a valid anonymous session request", () => {
    const parsed = anonymousSessionRequestSchema.parse({
      device_id: "11111111-1111-4111-8111-111111111111"
    });

    expect(parsed.device_id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("accepts a valid anonymous session response", () => {
    const parsed = anonymousSessionResponseSchema.parse({
      access_token: "jwt",
      refresh_token: "rt_123",
      user: {
        user_id: "22222222-2222-4222-8222-222222222222",
        level: "anonymous"
      }
    });

    expect(parsed.user.level).toBe("anonymous");
  });

  it("rejects malformed JWT claims", () => {
    const result = jwtClaimsSchema.safeParse({
      sub: "not-a-uuid",
      level: "anonymous",
      role: "user",
      community_ids: []
    });

    expect(result.success).toBe(false);
  });

  it("accepts resource list responses", () => {
    const parsed = resourceListResponseSchema.parse({
      items: [
        {
          provider_id: "22222222-2222-4222-8222-222222222222",
          name: "St. Kilian's Social Ministry",
          type: "pantry",
          address: "140 Elizabeth St., Farmingdale, NY 11735",
          city: "Farmingdale",
          state: "NY",
          zip: "11735",
          phone: "516-756-9656",
          languages: ["en"],
          source: "island_harvest",
          source_label: "Island Harvest",
          notes: null,
          distance_miles: 0.1,
          is_open_today: true,
          is_open_now: false,
          geo_precision: "street",
          directions_url: "https://maps.apple.com/?q=St.%20Kilian"
        }
      ],
      next_cursor: null,
      source_mode: "api"
    });

    expect(parsed.items[0]?.zip).toBe("11735");
  });

  it("accepts broad reports without conversation context", () => {
    const parsed = reportCreateRequestSchema.parse({
      target_type: "post",
      target_id: "33333333-3333-4333-8333-333333333333",
      reason: "other"
    });

    expect(parsed.target_type).toBe("post");
    expect(parsed.conversation_id).toBeUndefined();
  });

  it("accepts M6 bootstrap responses", () => {
    const parsed = communityBootstrapResponseSchema.parse({
      community_id: "44444444-4444-4444-8444-444444444444",
      bootstrap_version: "m6-demo-v1",
      anchor_node: {
        node_id: "12D3KooWAnchorPeer",
        websocket_url: "wss://anchor.weavenyc.local/p2p"
      },
      relay_nodes: [
        {
          node_id: "12D3KooWRelayPeer",
          websocket_url: "wss://relay.weavenyc.local/p2p",
          last_published_at: null
        }
      ],
      topics: {
        posts: "weavenyc/demo/posts",
        announcements: "weavenyc/demo/announcements",
        reports: "weavenyc/demo/reports"
      },
      latest_snapshot: {
        last_event_at: "2026-04-13T12:00:00.000Z",
        event_count: 1
      },
      mdns_demo_enabled: false
    });

    expect(parsed.topics.posts).toContain("posts");
  });

  it("accepts post sync envelopes", () => {
    const parsed = p2pEventEnvelopeSchema.parse({
      sync_event_id: "88888888-8888-4888-8888-888888888888",
      community_id: "44444444-4444-4444-8444-444444444444",
      topic: "weavenyc/demo/posts",
      event_type: "post.published",
      aggregate_type: "post",
      aggregate_id: "77777777-7777-4777-8777-777777777777",
      occurred_at: "2026-04-13T12:00:00.000Z",
      actor_p2p_id: "edge-demo-peer",
      cid: "bafybeigdyrztv4",
      signature: "sig_demo",
      payload: {
        post: {
          post_id: "77777777-7777-4777-8777-777777777777",
          status: "active",
        },
      }
    });

    expect(parsed.aggregate_type).toBe("post");
  });

  it("rejects mismatched event and payload combinations", () => {
    const parsed = p2pEventEnvelopeSchema.safeParse({
      sync_event_id: "88888888-8888-4888-8888-888888888888",
      community_id: "44444444-4444-4444-8444-444444444444",
      topic: "weavenyc/demo/reports",
      event_type: "report.created",
      aggregate_type: "post",
      aggregate_id: "77777777-7777-4777-8777-777777777777",
      occurred_at: "2026-04-13T12:00:00.000Z",
      cid: "bafybeigdyrztv4",
      payload: {
        post: {
          post_id: "77777777-7777-4777-8777-777777777777",
        },
      }
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects admin report queue items with deprecated in_review status", () => {
    const parsed = adminReportQueueResponseSchema.safeParse({
      items: [
        {
          report_id: "44444444-4444-4444-8444-444444444444",
          community_id: "55555555-5555-4555-8555-555555555555",
          target_type: "post",
          target_id: "66666666-6666-4666-8666-666666666666",
          reason: "unsafe_behavior",
          status: "in_review",
          created_at: "2026-04-12T12:00:00.000Z",
          reporter_user_id: "77777777-7777-4777-8777-777777777777",
          reporter_alias: "Reporter",
          priority: "P0",
          conversation_id: null,
          target_summary: {
            title: "Needs manual review",
            body_preview: "Context preview",
            related_user_id: null,
          },
          evidence_description: null,
        },
      ],
      next_cursor: null,
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts internal notification JWT claims", () => {
    const parsed = notificationInternalJwtClaimsSchema.parse({
      sub: "api-gateway",
      scope: "notifications_send",
      service: "api-gateway",
    });

    expect(parsed.scope).toBe("notifications_send");
  });

  it("accepts sms notification responses", () => {
    const parsed = notificationSmsSendResponseSchema.parse({
      provider: "stub",
      fallback: true,
      message_id: "SM123",
      to: "+15165550101",
      demo_code: "123456",
    });

    expect(parsed.provider).toBe("stub");
  });

  it("accepts email notification requests", () => {
    const parsed = notificationEmailSendRequestSchema.parse({
      email: "neighbor@example.com",
      challenge_id: "66666666-6666-4666-8666-666666666666",
      token: "ml_token",
    });

    expect(parsed.email).toBe("neighbor@example.com");
  });
});
