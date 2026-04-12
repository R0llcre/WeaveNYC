import { afterEach, describe, expect, it, vi } from "vitest";

import { createAnonymousSession, listCommunityAnnouncements, probeEndpoint } from "./api";

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

  it("loads community announcements and tolerates a missing endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              announcement_id: "ann_1",
              community_id: "comm_1",
              title: "Pantry hours",
              body: "Open Saturday morning.",
              is_pinned: true,
              published_at: "2026-04-04T12:00:00.000Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(listCommunityAnnouncements("token", "comm_1")).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          announcement_id: "ann_1",
          is_pinned: true,
        }),
      ],
    });

    await expect(listCommunityAnnouncements("token", "comm_2")).resolves.toEqual({
      items: [],
      next_cursor: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/communities/comm_1/announcements"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
  });

  it("accepts legacy pinned payloads but normalizes to is_pinned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              announcement_id: "ann_2",
              community_id: "comm_1",
              title: "Legacy payload",
              body: "Still supported.",
              pinned: true,
            },
          ],
        }),
      }),
    );

    await expect(listCommunityAnnouncements("token", "comm_1")).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          announcement_id: "ann_2",
          is_pinned: true,
        }),
      ],
    });
  });
});
