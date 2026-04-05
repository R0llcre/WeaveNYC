import { describe, expect, it } from "vitest";

import {
  anonymousAuthRequestSchema,
  anonymousAuthResponseSchema,
  healthcheckResponseSchema,
  meResponseSchema,
  readinessResponseSchema,
} from "../src/index.js";

describe("shared validators", () => {
  it("accepts the anonymous auth request payload", () => {
    expect(
      anonymousAuthRequestSchema.parse({
        device_id: "550e8400-e29b-41d4-a716-446655440000"
      })
    ).toEqual({
      device_id: "550e8400-e29b-41d4-a716-446655440000"
    });
  });

  it("rejects a malformed anonymous auth request payload", () => {
    expect(() =>
      anonymousAuthRequestSchema.parse({
        device_id: "device-123"
      })
    ).toThrow();
  });

  it("accepts M0 auth responses", () => {
    expect(
      anonymousAuthResponseSchema.parse({
        access_token: "jwt",
        refresh_token: "rt_fixture",
        user: {
          user_id: "550e8400-e29b-41d4-a716-446655440001",
          level: "anonymous"
        }
      })
    ).toBeTruthy();

    expect(
      meResponseSchema.parse({
        user: {
          user_id: "550e8400-e29b-41d4-a716-446655440001",
          level: "anonymous",
          role: "user",
          community_ids: []
        }
      })
    ).toBeTruthy();
  });

  it("accepts health and readiness payloads", () => {
    expect(
      healthcheckResponseSchema.parse({
        status: "ok",
        service: "api-gateway",
        timestamp: "2026-04-04T12:00:00.000Z"
      })
    ).toBeTruthy();

    expect(
      readinessResponseSchema.parse({
        status: "ok",
        service: "api-gateway",
        timestamp: "2026-04-04T12:00:00.000Z",
        checks: [
          {
            name: "postgres",
            status: "ok",
            latency_ms: 12
          },
          {
            name: "redis",
            status: "ok",
            latency_ms: 4
          }
        ]
      })
    ).toBeTruthy();
  });
});
