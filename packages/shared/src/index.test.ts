import { describe, expect, it } from "vitest";

import {
  adminReportQueueResponseSchema,
  anonymousSessionRequestSchema,
  anonymousSessionResponseSchema,
  jwtClaimsSchema,
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
});
