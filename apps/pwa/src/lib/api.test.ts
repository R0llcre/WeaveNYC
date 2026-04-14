import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAnonymousSession,
  getCommunitySyncWebSocketUrl,
  getCommunityBootstrap,
  getCommunitySyncDelta,
  listCommunityAnnouncements,
  probeEndpoint,
} from "./api";

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

  it("parses community bootstrap responses with fallback topics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          community_id: "comm_1",
          anchor_node: {
            node_id: "anchor_1",
            websocket_url: "wss://relay.weavenyc.test",
          },
          relay_nodes: [
            {
              node_id: "relay_1",
              websocket_url: "wss://relay-2.weavenyc.test",
            },
          ],
          latest_snapshot: {
            last_event_at: "2026-04-13T12:00:00.000Z",
            event_count: 4,
          },
          mdns_demo_enabled: false,
        }),
      }),
    );

    await expect(getCommunityBootstrap("token", "comm_1")).resolves.toMatchObject({
      community_id: "comm_1",
      topics: {
        posts: "weavenyc/comm_1/posts",
        announcements: "weavenyc/comm_1/announcements",
        reports: "weavenyc/comm_1/reports",
      },
      relay_nodes: [
        expect.objectContaining({
          node_id: "relay_1",
          websocket_url: "wss://relay-2.weavenyc.test",
        }),
      ],
    });
  });

  it("parses community sync deltas and keeps recognized events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          events: [
            {
              sync_event_id: "evt_1",
              event_type: "post.updated",
              aggregate_type: "post",
              aggregate_id: "post_1",
              occurred_at: "2026-04-13T12:02:00.000Z",
              payload_json: {
                title: "Updated title",
              },
            },
            {
              sync_event_id: "evt_ignored",
              event_type: "unsupported",
              aggregate_type: "post",
              aggregate_id: "post_2",
              occurred_at: "2026-04-13T12:03:00.000Z",
            },
          ],
          next_since: "2026-04-13T12:02:00.000Z",
          server_time: "2026-04-13T12:02:01.000Z",
          latest_snapshot: {
            snapshot_id: "snap_2",
          },
        }),
      }),
    );

    await expect(getCommunitySyncDelta("token", "comm_1", { since: "2026-04-13T11:59:00.000Z" })).resolves.toMatchObject({
      events: [
        expect.objectContaining({
          sync_event_id: "evt_1",
          event_type: "post.updated",
          aggregate_type: "post",
        }),
      ],
      next_since: "2026-04-13T12:02:00.000Z",
      server_time: "2026-04-13T12:02:01.000Z",
    });
  });

  it("preserves bootstrap-issued websocket credentials when present", () => {
    expect(
      getCommunitySyncWebSocketUrl(
        'wss://relay.weavenyc.test/v1/ws/p2p?token=ws_token',
        'jwt_token',
        'comm_1',
      ),
    ).toBe('wss://relay.weavenyc.test/v1/ws/p2p?token=ws_token&community_id=comm_1');
  });

  it("falls back to access token and community id for legacy websocket URLs", () => {
    expect(
      getCommunitySyncWebSocketUrl(
        'wss://relay.weavenyc.test/v1/ws/p2p',
        'jwt_token',
        'comm_1',
      ),
    ).toBe('wss://relay.weavenyc.test/v1/ws/p2p?token=jwt_token&community_id=comm_1');
  });
});
