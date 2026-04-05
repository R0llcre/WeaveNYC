import { describe, expect, it } from "vitest";

import {
  anonymousSessionRequestSchema,
  anonymousSessionResponseSchema,
  jwtClaimsSchema
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
});
