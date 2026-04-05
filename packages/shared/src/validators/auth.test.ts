import { describe, expect, it } from "vitest";

import {
  anonymousAuthRequestSchema,
  anonymousAuthResponseSchema,
} from "./auth";

describe("auth validators", () => {
  it("accepts a UUID device id", () => {
    expect(() =>
      anonymousAuthRequestSchema.parse({
        device_id: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).not.toThrow();
  });

  it("rejects malformed auth response payloads", () => {
    expect(() =>
      anonymousAuthResponseSchema.parse({
        access_token: "",
        refresh_token: "token",
        user: {
          user_id: "not-a-uuid",
          level: "anonymous",
        },
      }),
    ).toThrow();
  });
});
