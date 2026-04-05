import { afterEach, describe, expect, it, vi } from "vitest";

import { createAnonymousSession, probeEndpoint } from "./api";

describe("pwa api helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("probes health endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: "ok",
          service: "api-gateway",
          timestamp: "2026-04-04T12:00:00.000Z",
        }),
      }),
    );

    await expect(probeEndpoint("/healthz")).resolves.toMatchObject({
      ok: true,
      statusCode: 200,
      detail: "api-gateway ok",
    });
  });

  it("creates an anonymous session with a device id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "jwt",
        refresh_token: "rt_fixture",
        user: {
          user_id: "550e8400-e29b-41d4-a716-446655440001",
          level: "anonymous",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await createAnonymousSession();

    expect(response.user.level).toBe("anonymous");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/auth/anonymous"),
      expect.objectContaining({
        body: expect.stringContaining("device_id"),
      }),
    );
  });
});
