import { createHash, createHmac, randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestApp, createUserRecord, InMemoryRefreshTokenStore, InMemoryUserStore } from "./helpers.js";

const communityId = "44444444-4444-4444-8444-444444444444";
const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function signUser(app: Awaited<ReturnType<typeof createTestApp>>["app"], user: ReturnType<typeof createUserRecord>) {
  return app.jwt.sign(
    {
      sub: user.userId,
      level: user.level,
      role: user.role,
      community_ids: user.communityIds,
      anchor_community_id: user.anchorCommunityId ?? undefined,
    },
    {
      algorithm: "RS256",
      iss: app.config.jwt.issuer,
      expiresIn: app.config.jwt.accessTokenTtl,
    },
  );
}

function hashInviteCode(inviteCode: string) {
  return createHash("sha256").update(inviteCode.trim().toUpperCase()).digest("hex");
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = base32Alphabet.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 secret");
    }

    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateTotpCode(secret: string, now = Date.now()) {
  const counter = Math.floor(now / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** 6).padStart(6, "0");
}

function readTotpSecret(otpauthUri: string) {
  const url = new URL(otpauthUri);
  const secret = url.searchParams.get("secret");
  if (!secret) {
    throw new Error("TOTP secret missing from otpauth URI");
  }

  return secret;
}

describe("anchor admin routes", () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it("activates an anchor from a verified session and opens a TOTP step-up session", async () => {
    const userStore = new InMemoryUserStore();
    const verifiedUser = createUserRecord({
      userId: "22222222-2222-4222-8222-222222222222",
      level: "verified",
      communityIds: [communityId],
    });
    userStore.users.set(verifiedUser.userId, verifiedUser);
    userStore.anchorInvites.set(hashInviteCode("ANCHOR-DEMO-INVITE"), {
      inviteId: randomUUID(),
      communityId,
      communityName: "Farmingdale Demo Community",
      centerZip: "11735",
      joinPolicy: "invite_only",
      orgName: "St. Kilian Parish Social Ministry",
      status: "active",
    });

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const verifiedToken = signUser(app, verifiedUser);

    const activateResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/anchor/activate",
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { invite_code: "ANCHOR-DEMO-INVITE" },
    });

    expect(activateResponse.statusCode).toBe(200);
    const activateBody = activateResponse.json();
    expect(activateBody.community.community_id).toBe(communityId);
    expect(activateBody.recovery_codes).toHaveLength(8);

    const secret = readTotpSecret(activateBody.otpauth_uri);
    const confirmResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/anchor/activate/confirm",
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: {
        activation_id: activateBody.activation_id,
        totp_code: generateTotpCode(secret),
      },
    });

    expect(confirmResponse.statusCode).toBe(200);
    const confirmed = confirmResponse.json();
    expect(confirmed.user.level).toBe("anchor");
    expect(confirmed.issued_via).toBe("anchor_activate");

    const sessionStartResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/anchor/session/start",
      headers: { authorization: `Bearer ${confirmed.access_token}` },
      payload: { community_id: communityId },
    });

    expect(sessionStartResponse.statusCode).toBe(200);
    const sessionChallenge = sessionStartResponse.json();

    const sessionVerifyResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/anchor/session/verify",
      headers: { authorization: `Bearer ${confirmed.access_token}` },
      payload: {
        challenge_id: sessionChallenge.challenge_id,
        totp_code: generateTotpCode(secret),
      },
    });

    expect(sessionVerifyResponse.statusCode).toBe(200);
    expect(sessionVerifyResponse.json().issued_via).toBe("anchor_session");
    expect(sessionVerifyResponse.json().user.level).toBe("anchor");
  });

  it("serves dashboard, rules, announcements, and report queue decisions for anchors", async () => {
    const userStore = new InMemoryUserStore();
    const anchorUser = createUserRecord({
      userId: "33333333-3333-4333-8333-333333333333",
      level: "anchor",
      role: "anchor",
      communityIds: [communityId],
      anchorCommunityId: communityId,
    });
    const reporterUser = createUserRecord({
      userId: "22222222-2222-4222-8222-222222222222",
      level: "verified",
      communityIds: [communityId],
    });
    userStore.users.set(anchorUser.userId, anchorUser);
    userStore.users.set(reporterUser.userId, reporterUser);

    const { app, postsService, chatRepository, linkedMatchRepository } = await createTestApp({ userStore });
    apps.push(app);

    const anchorToken = signUser(app, anchorUser);
    const reporterToken = signUser(app, reporterUser);

    const reportTarget = await postsService.createPost({
      actor: {
        userId: reporterUser.userId,
        level: reporterUser.level,
        role: reporterUser.role,
        communityIds: reporterUser.communityIds,
      },
      request: {
        community_id: communityId,
        post_type: "request",
        category: "food",
        title: "Need pantry support",
        body: "Need pantry support after work.",
        language: "en",
        location_zip: "11735",
        privacy: "community_only",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    chatRepository.seedPostOwner(reportTarget.postId, reporterUser.userId);

    const offerPost = await postsService.createPost({
      actor: {
        userId: anchorUser.userId,
        level: anchorUser.level,
        role: anchorUser.role,
        communityIds: anchorUser.communityIds,
        anchorCommunityId: anchorUser.anchorCommunityId,
      },
      request: {
        community_id: communityId,
        post_type: "offer",
        category: "food",
        title: "Can do pantry pickup",
        body: "Can coordinate a pantry pickup tomorrow morning.",
        language: "en",
        location_zip: "11735",
        privacy: "community_only",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    await linkedMatchRepository?.saveContactRequest({
      contactRequestId: randomUUID(),
      fromPostId: reportTarget.postId,
      toPostId: offerPost.postId,
      requesterUserId: reporterUser.userId,
      recipientUserId: anchorUser.userId,
      requesterAlias: "Reporter",
      status: "accepted",
      createdAt: new Date().toISOString(),
      respondedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const reportCreateResponse = await app.inject({
      method: "POST",
      url: "/v1/reports",
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        target_type: "post",
        target_id: reportTarget.postId,
        reason: "unsafe_behavior",
        evidence_description: "Needs manual review",
      },
    });

    expect(reportCreateResponse.statusCode).toBe(200);

    const dashboardResponse = await app.inject({
      method: "GET",
      url: `/v1/admin/communities/${communityId}/dashboard`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });
    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.json()).toMatchObject({
      accepted_contacts_this_week_count: 1,
      reports_this_week_count: 1,
      pending_report_count: 1,
    });

    const rulesPutResponse = await app.inject({
      method: "PUT",
      url: `/v1/admin/communities/${communityId}/rules`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        review_categories: ["goods"],
        auto_hide_report_threshold: 2,
        keyword_blocklist: ["banned phrase"],
        language_preferences: ["en", "es"],
        announcement_pin_strategy: "manual",
      },
    });
    expect(rulesPutResponse.statusCode).toBe(200);
    expect(rulesPutResponse.json().review_categories).toEqual(["goods"]);

    const rulesGetResponse = await app.inject({
      method: "GET",
      url: `/v1/admin/communities/${communityId}/rules`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });
    expect(rulesGetResponse.statusCode).toBe(200);
    expect(rulesGetResponse.json().announcement_pin_strategy).toBe("manual");

    const announcementCreateResponse = await app.inject({
      method: "POST",
      url: `/v1/admin/communities/${communityId}/announcements`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        title: "Pantry schedule update",
        body: "Pantry opens one hour early tomorrow.",
        is_pinned: true,
      },
    });
    expect(announcementCreateResponse.statusCode).toBe(200);
    const announcementId = announcementCreateResponse.json().announcement_id as string;

    const announcementListResponse = await app.inject({
      method: "GET",
      url: `/v1/admin/communities/${communityId}/announcements`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });
    expect(announcementListResponse.statusCode).toBe(200);
    expect(announcementListResponse.json().items).toHaveLength(1);

    const communityAnnouncementResponse = await app.inject({
      method: "GET",
      url: `/v1/communities/${communityId}/announcements`,
      headers: { authorization: `Bearer ${reporterToken}` },
    });
    expect(communityAnnouncementResponse.statusCode).toBe(200);
    expect(communityAnnouncementResponse.json().items[0].announcement_id).toBe(announcementId);

    const reportQueueResponse = await app.inject({
      method: "GET",
      url: `/v1/admin/report_queue?community_id=${communityId}`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });
    expect(reportQueueResponse.statusCode).toBe(200);
    expect(reportQueueResponse.json().items).toHaveLength(1);

    const reportId = reportQueueResponse.json().items[0].report_id as string;
    const invalidStatusResponse = await app.inject({
      method: "GET",
      url: `/v1/admin/report_queue?community_id=${communityId}&status=in_review`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });
    expect(invalidStatusResponse.statusCode).toBe(400);

    const reportDecisionResponse = await app.inject({
      method: "POST",
      url: `/v1/admin/report_queue/${reportId}/decision`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        decision: "remove_post",
        notes: "Unsafe content removed during moderation",
      },
    });
    expect(reportDecisionResponse.statusCode).toBe(200);
    expect(reportDecisionResponse.json().resolution).toBe("remove_post");
    expect(postsService.posts.get(reportTarget.postId)?.status).toBe("removed");

    const goodsPostResponse = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        community_id: communityId,
        post_type: "request",
        category: "goods",
        title: "Need winter coat",
        body: "Need a winter coat for next week.",
        language: "en",
        location_zip: "11735",
        privacy: "community_only",
        expires_at: new Date(Date.now() + 120_000).toISOString(),
      },
    });
    expect(goodsPostResponse.statusCode).toBe(200);
    expect(goodsPostResponse.json().status).toBe("pending_review");
  });

  it("uses the community auto-hide threshold for in-memory report moderation", async () => {
    const userStore = new InMemoryUserStore();
    const anchorUser = createUserRecord({
      userId: "13131313-1313-4313-8313-131313131313",
      level: "anchor",
      role: "anchor",
      communityIds: [communityId],
      anchorCommunityId: communityId,
    });
    const postOwner = createUserRecord({
      userId: "14141414-1414-4414-8414-141414141414",
      level: "verified",
      communityIds: [communityId],
    });
    const reporterOne = createUserRecord({
      userId: "15151515-1515-4515-8515-151515151515",
      level: "verified",
      communityIds: [communityId],
    });
    const reporterTwo = createUserRecord({
      userId: "16161616-1616-4616-8616-161616161616",
      level: "verified",
      communityIds: [communityId],
    });
    userStore.users.set(anchorUser.userId, anchorUser);
    userStore.users.set(postOwner.userId, postOwner);
    userStore.users.set(reporterOne.userId, reporterOne);
    userStore.users.set(reporterTwo.userId, reporterTwo);

    const { app, postsService, chatRepository } = await createTestApp({ userStore });
    apps.push(app);

    const anchorToken = signUser(app, anchorUser);
    const reporterOneToken = signUser(app, reporterOne);
    const reporterTwoToken = signUser(app, reporterTwo);

    const rulesResponse = await app.inject({
      method: "PUT",
      url: `/v1/admin/communities/${communityId}/rules`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        review_categories: ["food"],
        auto_hide_report_threshold: 2,
        keyword_blocklist: [],
        language_preferences: ["en"],
        announcement_pin_strategy: "manual",
      },
    });
    expect(rulesResponse.statusCode).toBe(200);

    const targetPost = await postsService.createPost({
      actor: {
        userId: postOwner.userId,
        level: postOwner.level,
        role: postOwner.role,
        communityIds: postOwner.communityIds,
      },
      request: {
        community_id: communityId,
        post_type: "request",
        category: "goods",
        title: "Need canned goods",
        body: "Need canned goods for this week.",
        language: "en",
        location_zip: "11735",
        privacy: "community_only",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    chatRepository.seedPostOwner(targetPost.postId, postOwner.userId);

    const firstReport = await app.inject({
      method: "POST",
      url: "/v1/reports",
      headers: { authorization: `Bearer ${reporterOneToken}` },
      payload: {
        target_type: "post",
        target_id: targetPost.postId,
        reason: "unsafe_behavior",
      },
    });
    expect(firstReport.statusCode).toBe(200);
    expect(postsService.posts.get(targetPost.postId)?.status).toBe("active");

    const secondReport = await app.inject({
      method: "POST",
      url: "/v1/reports",
      headers: { authorization: `Bearer ${reporterTwoToken}` },
      payload: {
        target_type: "post",
        target_id: targetPost.postId,
        reason: "unsafe_behavior",
      },
    });
    expect(secondReport.statusCode).toBe(200);
    expect(postsService.posts.get(targetPost.postId)?.status).toBe("removed");

    const queueResponse = await app.inject({
      method: "GET",
      url: `/v1/admin/report_queue?community_id=${communityId}`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });
    expect(queueResponse.statusCode).toBe(200);
    expect(queueResponse.json().items).toHaveLength(0);
  });

  it("rejects admin access when an anchor is only a community member of the target community", async () => {
    const otherCommunityId = "55555555-5555-4555-8555-555555555555";
    const userStore = new InMemoryUserStore();
    const anchorUser = createUserRecord({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      level: "anchor",
      role: "anchor",
      communityIds: [communityId, otherCommunityId],
      anchorCommunityId: communityId,
    });
    userStore.users.set(anchorUser.userId, anchorUser);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const anchorToken = signUser(app, anchorUser);
    const response = await app.inject({
      method: "GET",
      url: `/v1/admin/review_queue?community_id=${otherCommunityId}`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it("demotes the displaced anchor user when a new anchor activates for the same community", async () => {
    const userStore = new InMemoryUserStore();
    const incumbentAnchor = createUserRecord({
      userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      level: "anchor",
      role: "anchor",
      communityIds: [communityId],
      anchorCommunityId: communityId,
    });
    const replacementUser = createUserRecord({
      userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      level: "verified",
      communityIds: [communityId],
    });
    userStore.users.set(incumbentAnchor.userId, incumbentAnchor);
    userStore.users.set(replacementUser.userId, replacementUser);
    userStore.anchors.set(communityId, {
      anchorId: randomUUID(),
      userId: incumbentAnchor.userId,
      communityId,
      orgName: "Incumbent Anchor",
      status: "active",
      totpSecretCiphertext: "ciphertext",
      recoveryCodesHashes: [],
      activatedAt: "2026-04-10T12:00:00.000Z",
      lastMfaAt: "2026-04-10T12:00:00.000Z",
    });
    userStore.anchorInvites.set(hashInviteCode("ANCHOR-REPLACE-INVITE"), {
      inviteId: randomUUID(),
      communityId,
      communityName: "Farmingdale Demo Community",
      centerZip: "11735",
      joinPolicy: "invite_only",
      orgName: "Replacement Anchor",
      status: "active",
    });

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const replacementToken = signUser(app, replacementUser);
    const displacedAnchorToken = signUser(app, incumbentAnchor);

    const activateBody = (
      await app.inject({
        method: "POST",
        url: "/v1/auth/anchor/activate",
        headers: { authorization: `Bearer ${replacementToken}` },
        payload: { invite_code: "ANCHOR-REPLACE-INVITE" },
      })
    ).json();
    const secret = readTotpSecret(activateBody.otpauth_uri);
    const confirmResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/anchor/activate/confirm",
      headers: { authorization: `Bearer ${replacementToken}` },
      payload: {
        activation_id: activateBody.activation_id,
        totp_code: generateTotpCode(secret),
      },
    });

    expect(confirmResponse.statusCode).toBe(200);
    const displacedUser = userStore.users.get(incumbentAnchor.userId);
    expect(displacedUser?.level).toBe("verified");
    expect(displacedUser?.role).toBe("user");
    expect(displacedUser?.anchorCommunityId).toBeNull();

    const reviewResponse = await app.inject({
      method: "GET",
      url: `/v1/admin/review_queue?community_id=${communityId}`,
      headers: { authorization: `Bearer ${displacedAnchorToken}` },
    });

    expect(reviewResponse.statusCode).toBe(403);
  });

  it("rejects cross-community announcement reads for anchors outside the target scope", async () => {
    const otherCommunityId = "66666666-6666-4666-8666-666666666666";
    const userStore = new InMemoryUserStore();
    const scopedAnchor = createUserRecord({
      userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      level: "anchor",
      role: "anchor",
      communityIds: [communityId],
      anchorCommunityId: communityId,
    });
    const otherAnchor = createUserRecord({
      userId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      level: "anchor",
      role: "anchor",
      communityIds: [otherCommunityId],
      anchorCommunityId: otherCommunityId,
    });
    userStore.users.set(scopedAnchor.userId, scopedAnchor);
    userStore.users.set(otherAnchor.userId, otherAnchor);

    const { app, postsService } = await createTestApp({ userStore });
    apps.push(app);

    await postsService.createAnnouncement({
      actor: {
        userId: otherAnchor.userId,
        level: otherAnchor.level,
        role: otherAnchor.role,
        communityIds: otherAnchor.communityIds,
        anchorCommunityId: otherAnchor.anchorCommunityId,
      },
      communityId: otherCommunityId,
      request: {
        title: "Other community update",
        body: "Only local members should read this.",
        is_pinned: false,
      },
    });

    const response = await app.inject({
      method: "GET",
      url: `/v1/communities/${otherCommunityId}/announcements`,
      headers: { authorization: `Bearer ${signUser(app, scopedAnchor)}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it("disconnects existing realtime sessions when a report decision suspends a user", async () => {
    const userStore = new InMemoryUserStore();
    const anchorUser = createUserRecord({
      userId: "12121212-1212-4212-8212-121212121212",
      level: "anchor",
      role: "anchor",
      communityIds: [communityId],
      anchorCommunityId: communityId,
    });
    const reporterUser = createUserRecord({
      userId: "34343434-3434-4434-8434-343434343434",
      level: "verified",
      communityIds: [communityId],
    });
    const targetUser = createUserRecord({
      userId: "56565656-5656-4565-8565-565656565656",
      level: "verified",
      communityIds: [communityId],
    });
    userStore.users.set(anchorUser.userId, anchorUser);
    userStore.users.set(reporterUser.userId, reporterUser);
    userStore.users.set(targetUser.userId, targetUser);

    const realtimeHub = {
      publishToUsers: vi.fn(async () => undefined),
      attachConnection: vi.fn(),
      detachConnection: vi.fn(),
      disconnectUser: vi.fn(),
      close: vi.fn(async () => undefined),
    };

    const { app, postsService, chatRepository } = await createTestApp({
      userStore,
      chatRealtimeHub: realtimeHub,
    });
    apps.push(app);

    const anchorToken = signUser(app, anchorUser);
    const reporterToken = signUser(app, reporterUser);

    const targetPost = await postsService.createPost({
      actor: {
        userId: targetUser.userId,
        level: targetUser.level,
        role: targetUser.role,
        communityIds: targetUser.communityIds,
      },
      request: {
        community_id: communityId,
        post_type: "request",
        category: "food",
        title: "Need pantry support",
        body: "Need pantry support at pickup time.",
        language: "en",
        location_zip: "11735",
        privacy: "community_only",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    chatRepository.seedPostOwner(targetPost.postId, targetUser.userId);

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/reports",
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        target_type: "post",
        target_id: targetPost.postId,
        reason: "scam",
        evidence_description: "Pretending to represent the pantry.",
      },
    });
    expect(createResponse.statusCode).toBe(200);

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
        notes: "Suspended during review",
      },
    });
    expect(decisionResponse.statusCode).toBe(200);
    expect(userStore.users.get(targetUser.userId)?.status).toBe("suspended");
    expect(realtimeHub.disconnectUser).toHaveBeenCalledWith(targetUser.userId, "Suspended user");
  });

  it("blocks metadata-only announcement updates when the stored copy contains blocked terms", async () => {
    const userStore = new InMemoryUserStore();
    const anchorUser = createUserRecord({
      userId: "78787878-7878-4787-8787-787878787878",
      level: "anchor",
      role: "anchor",
      communityIds: [communityId],
      anchorCommunityId: communityId,
    });
    userStore.users.set(anchorUser.userId, anchorUser);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const anchorToken = signUser(app, anchorUser);
    const createResponse = await app.inject({
      method: "POST",
      url: `/v1/admin/communities/${communityId}/announcements`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        title: "Cash only pickup",
        body: "Cash only pickup at the church office.",
      },
    });
    expect(createResponse.statusCode).toBe(200);
    const announcementId = createResponse.json().announcement_id as string;

    const rulesResponse = await app.inject({
      method: "PUT",
      url: `/v1/admin/communities/${communityId}/rules`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        review_categories: ["food"],
        auto_hide_report_threshold: 2,
        keyword_blocklist: ["cash only"],
        language_preferences: ["en"],
        announcement_pin_strategy: "manual",
      },
    });
    expect(rulesResponse.statusCode).toBe(200);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/v1/admin/communities/${communityId}/announcements/${announcementId}`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        is_pinned: true,
      },
    });
    expect(patchResponse.statusCode).toBe(400);
  });

  it("rejects refresh after the 4 hour anchor idle timeout", async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const verifiedUser = createUserRecord({
      userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      level: "verified",
      communityIds: [communityId],
    });
    userStore.users.set(verifiedUser.userId, verifiedUser);
    userStore.anchorInvites.set(hashInviteCode("ANCHOR-IDLE-INVITE"), {
      inviteId: randomUUID(),
      communityId,
      communityName: "Farmingdale Demo Community",
      centerZip: "11735",
      joinPolicy: "invite_only",
      orgName: "St. Kilian Parish Social Ministry",
      status: "active",
    });

    const { app } = await createTestApp({ userStore, refreshTokenStore });
    apps.push(app);
    const verifiedToken = signUser(app, verifiedUser);

    const activateBody = (
      await app.inject({
        method: "POST",
        url: "/v1/auth/anchor/activate",
        headers: { authorization: `Bearer ${verifiedToken}` },
        payload: { invite_code: "ANCHOR-IDLE-INVITE" },
      })
    ).json();
    const secret = readTotpSecret(activateBody.otpauth_uri);
    const confirmed = (
      await app.inject({
        method: "POST",
        url: "/v1/auth/anchor/activate/confirm",
        headers: { authorization: `Bearer ${verifiedToken}` },
        payload: {
          activation_id: activateBody.activation_id,
          totp_code: generateTotpCode(secret),
        },
      })
    ).json();

    const storedSession = refreshTokenStore.sessions.get(confirmed.refresh_token);
    if (!storedSession) {
      throw new Error("expected anchor refresh session to exist");
    }
    storedSession.lastActivityAt = new Date(Date.now() - 4 * 60 * 60 * 1000 - 5_000).toISOString();
    refreshTokenStore.sessions.set(confirmed.refresh_token, storedSession);

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: {
        refresh_token: confirmed.refresh_token,
      },
    });

    expect(refreshResponse.statusCode).toBe(401);
  });
});
