import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { createTestApp, createUserRecord, InMemoryUserStore } from "./helpers.js";
import { InMemoryP2PSyncRuntime, RedisP2PSyncRuntime } from "../src/lib/sync-runtime.js";

const communityId = "44444444-4444-4444-8444-444444444444";

function signUser(app: Awaited<ReturnType<typeof createTestApp>>["app"], user: ReturnType<typeof createUserRecord>) {
  return app.jwt.sign(
    {
      sub: user.userId,
      level: user.level,
      role: user.role,
      community_ids: user.communityIds,
      anchor_community_id: user.anchorCommunityId ?? undefined,
      mfa_verified_at: user.mfaVerifiedAt,
    },
    {
      algorithm: "RS256",
      iss: app.config.jwt.issuer,
      expiresIn: app.config.jwt.accessTokenTtl,
    },
  );
}

describe("p2p sync routes", () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it("returns bootstrap metadata and sync deltas for community members", async () => {
    const userStore = new InMemoryUserStore();
    const member = createUserRecord({ communityIds: [communityId], level: "verified" });
    const anchor = createUserRecord({
      userId: "88888888-8888-4888-8888-888888888888",
      level: "anchor",
      role: "anchor",
      communityIds: [communityId],
      anchorCommunityId: communityId,
      mfaVerifiedAt: new Date().toISOString(),
    });
    userStore.users.set(member.userId, member);
    userStore.users.set(anchor.userId, anchor);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const memberToken = signUser(app, member);
    const anchorToken = signUser(app, anchor);

    const bootstrapResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/bootstrap`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    expect(bootstrapResponse.statusCode).toBe(200);
    expect(bootstrapResponse.json()).toMatchObject({
      community_id: communityId,
      bootstrap_version: "m6-anchor-sync-v1",
      mdns_demo_enabled: false,
      topics: {
        posts: `weavenyc/${communityId}/posts`,
        announcements: `weavenyc/${communityId}/announcements`,
        reports: `weavenyc/${communityId}/reports`,
      },
    });
    const bootstrapWebSocketUrl = new URL(bootstrapResponse.json().anchor_node.websocket_url as string);
    expect(bootstrapWebSocketUrl.pathname).toBe("/v1/ws/p2p");
    expect(bootstrapWebSocketUrl.searchParams.get("token")).toEqual(expect.any(String));
    expect(bootstrapWebSocketUrl.searchParams.get("token")).not.toBe(memberToken);
    expect(bootstrapWebSocketUrl.searchParams.get("community_id")).toBeNull();

    const postResponse = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { authorization: `Bearer ${memberToken}` },
      payload: {
        community_id: communityId,
        post_type: "request",
        category: "food",
        title: "Need pantry help",
        body: "Need pantry help this week.",
        language: "en",
        location_zip: "11735",
        privacy: "community_only",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    expect(postResponse.statusCode).toBe(200);
    const postId = postResponse.json().post_id as string;

    const announcementResponse = await app.inject({
      method: "POST",
      url: `/v1/admin/communities/${communityId}/announcements`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        title: "Community pantry hours",
        body: "Open until 5pm today.",
        is_pinned: true,
      },
    });
    expect(announcementResponse.statusCode).toBe(200);

    const reportResponse = await app.inject({
      method: "POST",
      url: "/v1/reports",
      headers: { authorization: `Bearer ${memberToken}` },
      payload: {
        target_type: "post",
        target_id: postId,
        reason: "misinformation",
        evidence_description: "Hours are inaccurate.",
      },
    });
    expect(reportResponse.statusCode).toBe(200);

    const queueResponse = await app.inject({
      method: "GET",
      url: `/v1/admin/report_queue?community_id=${communityId}`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });
    expect(queueResponse.statusCode).toBe(200);
    const reportId = queueResponse.json().items[0].report_id as string;

    const decisionResponse = await app.inject({
      method: "POST",
      url: `/v1/admin/report_queue/${reportId}/decision`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        decision: "remove_post",
        notes: "Removing misleading post copy.",
      },
    });
    expect(decisionResponse.statusCode).toBe(200);

    const syncResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/sync`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(syncResponse.statusCode).toBe(200);
    expect(syncResponse.json().events.map((event: { event_type: string }) => event.event_type)).toEqual(
      expect.arrayContaining([
        "post.published",
        "announcement.published",
        "report.created",
        "moderation.decision",
        "post.tombstoned",
      ]),
    );
  });

  it("streams sync events over the dedicated p2p websocket without using chat websocket", async () => {
    const userStore = new InMemoryUserStore();
    const member = createUserRecord({ communityIds: [communityId], level: "verified" });
    userStore.users.set(member.userId, member);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const memberToken = signUser(app, member);
    const bootstrapResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/bootstrap`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(bootstrapResponse.statusCode).toBe(200);
    const websocketUrl = bootstrapResponse.json().anchor_node.websocket_url as string;

    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected bound server address");
    }

    let readyResolved = false;
    let readyResolve!: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      readyResolve = resolve;
    });
    const framesPromise = new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      const received: Array<Record<string, unknown>> = [];
      const resolvedUrl = new URL(websocketUrl);
      resolvedUrl.protocol = "ws:";
      resolvedUrl.host = `127.0.0.1:${address.port}`;
      const socket = new WebSocket(resolvedUrl);

      socket.on("message", (payload) => {
        received.push(JSON.parse(payload.toString()) as Record<string, unknown>);
        if (!readyResolved && received[0]?.frame_type === "ready") {
          readyResolved = true;
          readyResolve();
        }
        if (received.length === 2) {
          socket.close();
          resolve(received);
        }
      });
      socket.once("error", reject);
    });

    await readyPromise;

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { authorization: `Bearer ${memberToken}` },
      payload: {
        community_id: communityId,
        post_type: "request",
        category: "goods",
        title: "Need baby supplies",
        body: "Need diapers and wipes.",
        language: "en",
        location_zip: "11735",
        privacy: "community_only",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    expect(createResponse.statusCode).toBe(200);

    const frames = await framesPromise;
    expect(frames[0]).toMatchObject({
      frame_type: "ready",
      community_id: communityId,
    });
    expect(frames[1]).toMatchObject({
      frame_type: "event",
      event: {
        community_id: communityId,
        event_type: "post.published",
      },
    });
  });

  it("prefers forwarded host/proto when minting bootstrap websocket URLs", async () => {
    const userStore = new InMemoryUserStore();
    const member = createUserRecord({ communityIds: [communityId], level: "verified" });
    userStore.users.set(member.userId, member);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const memberToken = signUser(app, member);

    const bootstrapResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/bootstrap`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        host: "internal.service:4000",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "pilot.weavenyc.test",
      },
    });

    expect(bootstrapResponse.statusCode).toBe(200);
    expect(bootstrapResponse.json().anchor_node.websocket_url).toMatch(
      /^wss:\/\/pilot\.weavenyc\.test\/v1\/ws\/p2p\?token=/,
    );
  });

  it("mints a fresh websocket token on each bootstrap request", async () => {
    const userStore = new InMemoryUserStore();
    const member = createUserRecord({ communityIds: [communityId], level: "verified" });
    userStore.users.set(member.userId, member);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const memberToken = signUser(app, member);

    const firstResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/bootstrap`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    const secondResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/bootstrap`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);

    const firstToken = new URL(firstResponse.json().anchor_node.websocket_url as string).searchParams.get("token");
    const secondToken = new URL(secondResponse.json().anchor_node.websocket_url as string).searchParams.get("token");

    expect(firstToken).toEqual(expect.any(String));
    expect(secondToken).toEqual(expect.any(String));
    expect(firstToken).not.toBe(secondToken);
  });

  it("uses an opaque cursor that preserves same-timestamp siblings", async () => {
    const userStore = new InMemoryUserStore();
    const member = createUserRecord({ communityIds: [communityId], level: "verified" });
    userStore.users.set(member.userId, member);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const memberToken = signUser(app, member);
    const occurredAt = "2026-04-13T12:00:00.000Z";

    await app.syncRuntime.publish({
      communityId,
      topicKey: "posts",
      eventType: "post.published",
      aggregateType: "post",
      aggregateId: "11111111-1111-4111-8111-111111111111",
      actorUserId: member.userId,
      payload: { post: { post_id: "11111111-1111-4111-8111-111111111111" } },
      occurredAt,
    });
    await app.syncRuntime.publish({
      communityId,
      topicKey: "posts",
      eventType: "post.updated",
      aggregateType: "post",
      aggregateId: "22222222-2222-4222-8222-222222222222",
      actorUserId: member.userId,
      payload: { post: { post_id: "22222222-2222-4222-8222-222222222222" } },
      occurredAt,
    });

    const firstPage = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/sync?limit=1`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json().events).toHaveLength(1);
    expect(firstPage.json().next_since).toMatch(/^v1\./);

    const secondPage = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/sync?limit=1&since=${encodeURIComponent(firstPage.json().next_since as string)}`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json().events).toHaveLength(1);
    expect(secondPage.json().events[0].sync_event_id).not.toBe(firstPage.json().events[0].sync_event_id);
  });

  it("sanitizes report and moderation sync payloads for community readers", async () => {
    const userStore = new InMemoryUserStore();
    const member = createUserRecord({ communityIds: [communityId], level: "verified" });
    const anchor = createUserRecord({
      userId: "88888888-8888-4888-8888-888888888888",
      level: "anchor",
      role: "anchor",
      communityIds: [communityId],
      anchorCommunityId: communityId,
      mfaVerifiedAt: new Date().toISOString(),
    });
    userStore.users.set(member.userId, member);
    userStore.users.set(anchor.userId, anchor);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const memberToken = signUser(app, member);
    const anchorToken = signUser(app, anchor);

    const postResponse = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { authorization: `Bearer ${memberToken}` },
      payload: {
        community_id: communityId,
        post_type: "request",
        category: "food",
        title: "Need pantry help",
        body: "Need pantry help this week.",
        language: "en",
        location_zip: "11735",
        privacy: "community_only",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    expect(postResponse.statusCode).toBe(200);
    const postId = postResponse.json().post_id as string;

    const reportResponse = await app.inject({
      method: "POST",
      url: "/v1/reports",
      headers: { authorization: `Bearer ${memberToken}` },
      payload: {
        target_type: "post",
        target_id: postId,
        reason: "misinformation",
        evidence_description: "Hours are inaccurate.",
      },
    });
    expect(reportResponse.statusCode).toBe(200);

    const queueResponse = await app.inject({
      method: "GET",
      url: `/v1/admin/report_queue?community_id=${communityId}`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });
    expect(queueResponse.statusCode).toBe(200);
    const reportId = queueResponse.json().items[0].report_id as string;

    const decisionResponse = await app.inject({
      method: "POST",
      url: `/v1/admin/report_queue/${reportId}/decision`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        decision: "remove_post",
        notes: "Removing misleading post copy.",
      },
    });
    expect(decisionResponse.statusCode).toBe(200);

    const syncResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/sync`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(syncResponse.statusCode).toBe(200);
    const reportCreated = syncResponse
      .json()
      .events.find((event: { event_type: string }) => event.event_type === "report.created");
    const moderationDecision = syncResponse
      .json()
      .events.find((event: { event_type: string }) => event.event_type === "moderation.decision");

    expect(reportCreated.actor_user_id).toBeUndefined();
    expect(reportCreated.actor_p2p_id).toMatch(/^actor_/);
    expect(reportCreated.payload).toMatchObject({
      report_id: reportId,
      target_type: "post",
      target_id: postId,
      reason: "misinformation",
      status: "new",
    });

    expect(moderationDecision.actor_user_id).toBeUndefined();
    expect(moderationDecision.actor_p2p_id).toMatch(/^actor_/);
    expect(moderationDecision.aggregate_id).not.toBe(reportId);
    expect(moderationDecision.payload).toMatchObject({
      report_id: reportId,
      target_type: "post",
      target_id: postId,
      report_target_type: "post",
      report_target_id: postId,
      resolution: "remove_post",
      status: "resolved",
    });
  });

  it("does not publish user-target report or moderation payloads into the community overlay", async () => {
    const userStore = new InMemoryUserStore();
    const reporter = createUserRecord({ communityIds: [communityId], level: "verified" });
    const targetUser = createUserRecord({
      userId: "99999999-9999-4999-8999-999999999999",
      communityIds: [communityId],
      level: "verified",
    });
    const anchor = createUserRecord({
      userId: "88888888-8888-4888-8888-888888888888",
      level: "anchor",
      role: "anchor",
      communityIds: [communityId],
      anchorCommunityId: communityId,
      mfaVerifiedAt: new Date().toISOString(),
    });
    userStore.users.set(reporter.userId, reporter);
    userStore.users.set(targetUser.userId, targetUser);
    userStore.users.set(anchor.userId, anchor);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const reporterToken = signUser(app, reporter);
    const anchorToken = signUser(app, anchor);

    const reportResponse = await app.inject({
      method: "POST",
      url: "/v1/reports",
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        target_type: "user",
        target_id: targetUser.userId,
        reason: "unsafe_behavior",
        evidence_description: "Unsafe conduct",
      },
    });
    expect(reportResponse.statusCode).toBe(200);

    const syncRuntime = app.syncRuntime as unknown as InMemoryP2PSyncRuntime;
    const reportEvent = syncRuntime.publishedEvents.find(
      (event: { event_type: string }) => event.event_type === "report.created",
    );
    expect(reportEvent).toBeUndefined();

    const queueResponse = await app.inject({
      method: "GET",
      url: `/v1/admin/report_queue?community_id=${communityId}`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });
    expect(queueResponse.statusCode).toBe(200);
    const reportId = queueResponse.json().items[0].report_id as string;

    const decisionResponse = await app.inject({
      method: "POST",
      url: `/v1/admin/report_queue/${reportId}/decision`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        decision: "suspend_user",
        notes: "Suspend the actual target user",
      },
    });
    expect(decisionResponse.statusCode).toBe(200);

    const moderationEvent = syncRuntime.publishedEvents.find(
      (event: { event_type: string; payload: Record<string, unknown> }) =>
        event.event_type === "moderation.decision" && event.payload.report_id === reportId,
    );
    expect(moderationEvent).toBeUndefined();
  });

  it("durably appends sync events before attempting live publish", async () => {
    const calls: string[] = [];
    const publisher: any = {
      publish: async () => {
        calls.push("publish");
        return 1;
      },
      quit: async () => undefined,
    };
    const subscriber: any = {
      psubscribe: async () => {
        calls.push("psubscribe");
        return 1;
      },
      on: () => undefined,
      quit: async () => undefined,
    };
    const database: any = {
      query: async () => {
        calls.push("insert");
        return { rows: [], rowCount: 1 };
      },
      end: async () => undefined,
    };

    const runtime = new RedisP2PSyncRuntime(
      "redis://example",
      "postgres://example",
      { nodeId: "node-1" },
      {
        publisher,
        subscriber,
        database,
        ready: Promise.resolve(),
      },
    );

    const result = await runtime.publish({
      communityId,
      topicKey: "posts",
      eventType: "post.published",
      aggregateType: "post",
      aggregateId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "77777777-7777-4777-8777-777777777777",
      payload: {
        post: { post_id: "11111111-1111-4111-8111-111111111111" },
      },
      occurredAt: "2026-04-13T12:00:00.000Z",
    });

    expect(calls).toEqual(["insert", "publish"]);
    expect(result.durablePublished).toBe(true);
    expect(result.livePublished).toBe(true);
  });

  it("keeps user-target reports out of the community sync stream", async () => {
    const userStore = new InMemoryUserStore();
    const reporter = createUserRecord({ communityIds: [communityId], level: "verified" });
    const targetUser = createUserRecord({
      userId: "99999999-9999-4999-8999-999999999999",
      communityIds: [communityId],
      level: "verified",
    });
    userStore.users.set(reporter.userId, reporter);
    userStore.users.set(targetUser.userId, targetUser);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const reporterToken = signUser(app, reporter);

    const reportResponse = await app.inject({
      method: "POST",
      url: "/v1/reports",
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        target_type: "user",
        target_id: targetUser.userId,
        reason: "unsafe_behavior",
        evidence_description: "Unsafe conduct",
      },
    });
    expect(reportResponse.statusCode).toBe(200);

    const syncResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/sync`,
      headers: { authorization: `Bearer ${reporterToken}` },
    });
    expect(syncResponse.statusCode).toBe(200);
    expect(
      syncResponse.json().events.some((event: { event_type: string }) => event.event_type === "report.created"),
    ).toBe(false);
  });
});
