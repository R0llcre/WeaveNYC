import { describe, expect, it } from "vitest";

import {
  anonymousAuthRequestSchema,
  anonymousAuthResponseSchema,
  magicLinkStartResponseSchema,
  otpStartResponseSchema,
  refreshSessionRequestSchema,
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

  it("accepts a refresh request with a non-empty token", () => {
    expect(() =>
      refreshSessionRequestSchema.parse({
        refresh_token: "rt_example",
      }),
    ).not.toThrow();
  });

  it("accepts stub otp responses", () => {
    expect(() =>
      otpStartResponseSchema.parse({
        challenge_id: "550e8400-e29b-41d4-a716-446655440000",
        masked_destination: "***1234",
        delivery_channel: "sms",
        expires_in_seconds: 600,
        fallback: true,
        demo_code: "123456",
      }),
    ).not.toThrow();
  });

  it("accepts stub magic-link responses", () => {
    expect(() =>
      magicLinkStartResponseSchema.parse({
        challenge_id: "550e8400-e29b-41d4-a716-446655440000",
        masked_destination: "a***@example.com",
        delivery_channel: "email",
        expires_in_seconds: 900,
        fallback: true,
        demo_token: "abc",
        demo_url: "http://localhost:3000/verify?challenge_id=1&token=abc",
      }),
    ).not.toThrow();
  });
});
