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

  it("does not leak events from community B into community A sync response", async () => {
    const communityA = communityId;
    const communityB = "55555555-5555-4555-8555-555555555555";

    const userStore = new InMemoryUserStore();
    const memberA = createUserRecord({ communityIds: [communityA], level: "verified" });
    const memberB = createUserRecord({
      userId: "66666666-6666-4666-8666-666666666666",
      communityIds: [communityB],
      level: "verified",
    });
    userStore.users.set(memberA.userId, memberA);
    userStore.users.set(memberB.userId, memberB);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const memberAToken = signUser(app, memberA);
    const memberBToken = signUser(app, memberB);

    // Publish 2 distinct events to each community.
    await app.syncRuntime.publish({
      communityId: communityA,
      topicKey: "posts",
      eventType: "post.published",
      aggregateType: "post",
      aggregateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorUserId: memberA.userId,
      payload: { post: { post_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
      occurredAt: "2026-04-13T12:00:00.000Z",
    });
    await app.syncRuntime.publish({
      communityId: communityB,
      topicKey: "posts",
      eventType: "post.published",
      aggregateType: "post",
      aggregateId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorUserId: memberB.userId,
      payload: { post: { post_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } },
      occurredAt: "2026-04-13T12:00:01.000Z",
    });

    // A's /sync must contain only A's event.
    const aSync = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityA}/sync`,
      headers: { authorization: `Bearer ${memberAToken}` },
    });
    expect(aSync.statusCode).toBe(200);
    const aEvents = aSync.json().events as Array<{ community_id: string; aggregate_id: string }>;
    expect(aEvents).toHaveLength(1);
    expect(aEvents[0].community_id).toBe(communityA);
    expect(aEvents[0].aggregate_id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    // Belt-and-suspenders: nothing whatsoever from B bleeds in.
    expect(aEvents.some((evt) => evt.community_id === communityB)).toBe(false);
    expect(
      aEvents.some((evt) => evt.aggregate_id === "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    ).toBe(false);

    // B's /sync must contain only B's event.
    const bSync = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityB}/sync`,
      headers: { authorization: `Bearer ${memberBToken}` },
    });
    expect(bSync.statusCode).toBe(200);
    const bEvents = bSync.json().events as Array<{ community_id: string; aggregate_id: string }>;
    expect(bEvents).toHaveLength(1);
    expect(bEvents[0].community_id).toBe(communityB);
    expect(bEvents[0].aggregate_id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("WebSocket fanout does not leak events from community B into community A subscribers", async () => {
    const communityA = communityId;
    const communityB = "55555555-5555-4555-8555-555555555555";

    const userStore = new InMemoryUserStore();
    const memberA = createUserRecord({ communityIds: [communityA], level: "verified" });
    const memberB = createUserRecord({
      userId: "66666666-6666-4666-8666-666666666666",
      communityIds: [communityB],
      level: "verified",
    });
    userStore.users.set(memberA.userId, memberA);
    userStore.users.set(memberB.userId, memberB);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const memberAToken = signUser(app, memberA);

    const bootstrapResponseA = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityA}/bootstrap`,
      headers: { authorization: `Bearer ${memberAToken}` },
    });
    expect(bootstrapResponseA.statusCode).toBe(200);
    const wsUrlA = bootstrapResponseA.json().anchor_node.websocket_url as string;

    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected bound server address");
    }

    const resolvedUrlA = new URL(wsUrlA);
    resolvedUrlA.protocol = "ws:";
    resolvedUrlA.host = `127.0.0.1:${address.port}`;

    const aFrames: Array<Record<string, unknown>> = [];
    let readyResolveA!: () => void;
    const readyA = new Promise<void>((resolve) => {
      readyResolveA = resolve;
    });

    const socketA = new WebSocket(resolvedUrlA);
    socketA.on("message", (payload) => {
      const frame = JSON.parse(payload.toString()) as Record<string, unknown>;
      aFrames.push(frame);
      if (frame.frame_type === "ready") {
        readyResolveA();
      }
    });
    await readyA;

    // Publish an event only to community B. A's socket must NOT receive it.
    await app.syncRuntime.publish({
      communityId: communityB,
      topicKey: "posts",
      eventType: "post.published",
      aggregateType: "post",
      aggregateId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorUserId: memberB.userId,
      payload: { post: { post_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } },
    });

    // Give the event loop a tick; no B event should arrive on A.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    const eventFramesOnA = aFrames.filter((frame) => frame.frame_type === "event");
    expect(eventFramesOnA).toHaveLength(0);

    // Now publish to A — it SHOULD arrive.
    await app.syncRuntime.publish({
      communityId: communityA,
      topicKey: "posts",
      eventType: "post.published",
      aggregateType: "post",
      aggregateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorUserId: memberA.userId,
      payload: { post: { post_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
    });

    await new Promise<void>((resolve) => {
      const check = () => {
        const event = aFrames.find(
          (frame) =>
            frame.frame_type === "event" &&
            ((frame.event as { aggregate_id?: string }).aggregate_id ===
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
        );
        if (event) {
          socketA.close();
          resolve();
        } else {
          setImmediate(check);
        }
      };
      check();
    });

    const finalEventFrames = aFrames.filter((frame) => frame.frame_type === "event");
    expect(finalEventFrames).toHaveLength(1);
    expect((finalEventFrames[0].event as { community_id: string }).community_id).toBe(communityA);
  });

  it("rejects bootstrap when caller is not a community member (403)", async () => {
    const otherCommunityId = "77777777-7777-4777-8777-777777777777";
    const userStore = new InMemoryUserStore();
    const nonMember = createUserRecord({ communityIds: [otherCommunityId], level: "verified" });
    userStore.users.set(nonMember.userId, nonMember);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const token = signUser(app, nonMember);

    const response = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/bootstrap`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().message).toBe("Community membership is required");
  });

  it("rejects websocket when the token scope is not p2p_ws (1008)", async () => {
    const userStore = new InMemoryUserStore();
    const member = createUserRecord({ communityIds: [communityId], level: "verified" });
    userStore.users.set(member.userId, member);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    // signUser() mints a primary access token — no `scope: 'p2p_ws'` claim.
    // This is EXACTLY the token that must be rejected at the WS handshake.
    const primaryToken = signUser(app, member);

    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected bound server address");
    }

    const result = await new Promise<{ code: number; reason: string }>((resolve, reject) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${address.port}/v1/ws/p2p?token=${encodeURIComponent(primaryToken)}&community_id=${communityId}`,
      );
      socket.on("close", (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
      socket.on("error", () => {
        // Closing with 1008 normally shows up as a close event, but some
        // clients fire `error` first on an early server close — either
        // signal is acceptable for this test; just fall through so we
        // resolve via the `close` listener.
      });
      setTimeout(() => reject(new Error("timeout waiting for ws close")), 3_000);
    });

    expect(result.code).toBe(1008);
    // The wire reason is deliberately generic — no "invalid scope" leaks.
    expect(result.reason).toBe("unauthorized");
  });

  it("rejects websocket when token community_id mismatches query (1008)", async () => {
    const otherCommunityId = "55555555-5555-4555-8555-555555555555";
    const userStore = new InMemoryUserStore();
    const member = createUserRecord({ communityIds: [communityId], level: "verified" });
    userStore.users.set(member.userId, member);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const bootstrapResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/bootstrap`,
      headers: { authorization: `Bearer ${signUser(app, member)}` },
    });
    expect(bootstrapResponse.statusCode).toBe(200);
    const wsToken = new URL(bootstrapResponse.json().anchor_node.websocket_url as string).searchParams.get(
      "token",
    )!;

    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected bound server address");
    }

    const result = await new Promise<{ code: number; reason: string }>((resolve, reject) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${address.port}/v1/ws/p2p?token=${encodeURIComponent(wsToken)}&community_id=${otherCommunityId}`,
      );
      socket.on("close", (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
      socket.on("error", () => {});
      setTimeout(() => reject(new Error("timeout waiting for ws close")), 3_000);
    });

    expect(result.code).toBe(1008);
    expect(result.reason).toBe("unauthorized");
  });

  it("rejects websocket for an inactive user (1008)", async () => {
    const userStore = new InMemoryUserStore();
    const member = createUserRecord({ communityIds: [communityId], level: "verified" });
    userStore.users.set(member.userId, member);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const bootstrapResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/bootstrap`,
      headers: { authorization: `Bearer ${signUser(app, member)}` },
    });
    expect(bootstrapResponse.statusCode).toBe(200);
    const wsToken = new URL(bootstrapResponse.json().anchor_node.websocket_url as string).searchParams.get(
      "token",
    )!;

    // Flip status to suspended AFTER bootstrap has minted the p2p_ws token.
    // The subsequent WS handshake must detect the stale claim and reject.
    const current = userStore.users.get(member.userId)!;
    userStore.users.set(member.userId, { ...current, status: "suspended" });

    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected bound server address");
    }

    const result = await new Promise<{ code: number; reason: string }>((resolve, reject) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${address.port}/v1/ws/p2p?token=${encodeURIComponent(wsToken)}`,
      );
      socket.on("close", (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
      socket.on("error", () => {});
      setTimeout(() => reject(new Error("timeout waiting for ws close")), 3_000);
    });

    expect(result.code).toBe(1008);
    expect(result.reason).toBe("unauthorized");
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
