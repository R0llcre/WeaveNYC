import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import process from "node:process";

import { Pool } from "pg";

import { seedIds, seedValues } from "../../packages/db/seed/fixtures.js";
import { loadConfig } from "../../services/api-gateway/src/config.js";
import { clearRedisAuthAbuseKeys } from "../../services/api-gateway/src/lib/identity.js";

const apiBaseUrl = (process.env.WEAVENYC_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const communityId = process.env.WEAVENYC_P2P_COMMUNITY_ID ?? seedIds.communityId;
const strictMode = process.env.WEAVENYC_P2P_SMOKE_STRICT !== "0";
const syncTimeoutMs = Number(process.env.WEAVENYC_P2P_SMOKE_TIMEOUT_MS ?? "8000");
const initialCursor = "1970-01-01T00:00:00.000Z";
const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

type BootstrapResponse = {
  community_id: string;
  bootstrap_version: string;
  anchor_node: {
    node_id: string;
    websocket_url: string;
  } | null;
  relay_nodes: Array<{
    node_id: string;
    websocket_url: string;
  }>;
  topics: Record<string, string>;
  latest_snapshot: {
    last_event_at: string | null;
    event_count: number;
  };
  mdns_demo_enabled: boolean;
};

type SyncEvent = {
  sync_event_id: string;
  community_id: string;
  topic: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  occurred_at: string;
  actor_p2p_id?: string | null;
  cid?: string | null;
  payload?: Record<string, unknown> & {
    post?: {
      post_id: string;
      community_id?: string;
      title?: string;
      post_type?: string;
      category?: string;
      privacy?: string;
      status?: string;
      p2p_version?: number;
      ipfs_cid?: string | null;
    };
    reason?: string | null;
    report_id?: string | null;
  };
};

type SyncDeltaResponse = {
  events: SyncEvent[];
  next_since: string | null;
  server_time: string;
  latest_snapshot: {
    last_event_at: string | null;
    event_count: number;
  };
};

type AuthSessionResponse = {
  access_token: string;
  refresh_token: string;
  user: {
    user_id: string;
    level: string;
  };
};

type CommunityResolveResponse = {
  community: {
    community_id: string;
    name: string;
  };
  join_token: string;
  entry: "invite_code" | "qr_token";
};

type JoinCommunityResponse = {
  community_id: string;
  membership_status: "joined" | "already_joined";
};

type CreatePostResponse = {
  post_id: string;
  status: string;
  risk_level: string;
};

type OtpStartResponse = {
  challenge_id: string;
  fallback: boolean;
  demo_code?: string;
};

type AnchorActivateResponse = {
  activation_id: string;
  community: {
    community_id: string;
    name: string;
    center_zip: string;
    join_policy: string;
  };
  otpauth_uri: string;
  recovery_codes: string[];
  expires_in_seconds: number;
};

type AnchorSessionStartResponse = {
  challenge_id: string;
  expires_in_seconds: number;
};

type AnnouncementCreateResponse = {
  announcement_id: string;
  title: string;
  status: "active" | "deleted";
};

type ReportCreateResponse = {
  report_id: string;
  status: "new";
  created_at: string;
};

type ReportDecisionResponse = {
  report_id: string;
  status: "resolved" | "dismissed";
  resolution: "warn" | "remove_post" | "suspend_user" | "none";
  decided_at: string;
};

async function main() {
  await waitForReady();
  await resetAuthAbuseState();
  await resetCommunitySyncEvents();
  await expectOk("/healthz");
  await expectOk("/readyz");

  const writer = await createAnonymousSession();
  const reader = await createAnonymousSession();

  await joinCommunityByInvite(writer.access_token, communityId, seedValues.communityInviteCode);
  await joinCommunityByInvite(reader.access_token, communityId, seedValues.communityInviteCode);

  const writerBootstrap = await fetchOptionalJson<BootstrapResponse>(`/v1/communities/${communityId}/bootstrap`, writer.access_token);
  const readerBootstrap = await fetchOptionalJson<BootstrapResponse>(`/v1/communities/${communityId}/bootstrap`, reader.access_token);

  const missingSurfaces = [
    writerBootstrap.status === 404 ? "GET /v1/communities/:community_id/bootstrap" : null,
    readerBootstrap.status === 404 ? "GET /v1/communities/:community_id/bootstrap" : null,
  ].filter(Boolean) as string[];

  if (missingSurfaces.length > 0) {
    const message = `P2P smoke failed: missing M6 surface(s): ${Array.from(new Set(missingSurfaces)).join(", ")}`;
    if (strictMode) {
      throw new Error(message);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          strict: false,
          reason: message,
        },
        null,
        2,
      ),
    );
    return;
  }

  assert.equal(writerBootstrap.status, 200, "writer bootstrap should return 200");
  assert.equal(readerBootstrap.status, 200, "reader bootstrap should return 200");
  assert.ok(writerBootstrap.body, "writer bootstrap response body should exist");
  assert.ok(readerBootstrap.body, "reader bootstrap response body should exist");

  assert.equal(writerBootstrap.body.community_id, communityId, "writer bootstrap should echo the requested community_id");
  assert.equal(readerBootstrap.body.community_id, communityId, "reader bootstrap should echo the requested community_id");
  assert.equal(writerBootstrap.body.bootstrap_version, "m6-anchor-sync-v1", "bootstrap version should match the M6 runtime contract");
  assert.equal(readerBootstrap.body.bootstrap_version, "m6-anchor-sync-v1", "bootstrap version should match the M6 runtime contract");
  const bootstrapWebSocketUrl = new URL(writerBootstrap.body.anchor_node?.websocket_url ?? "");
  assert.equal(bootstrapWebSocketUrl.pathname, "/v1/ws/p2p", "bootstrap websocket_url should target the dedicated P2P socket");
  assert.ok(bootstrapWebSocketUrl.searchParams.get("token"), "bootstrap websocket_url should embed a websocket-scoped token");
  assert.notEqual(
    bootstrapWebSocketUrl.searchParams.get("token"),
    writer.access_token,
    "bootstrap websocket_url must not leak the caller bearer access token",
  );
  assert.equal(
    writerBootstrap.body.topics.posts,
    `weavenyc/${communityId}/posts`,
    "posts topic should be community-scoped",
  );
  assert.deepEqual(writerBootstrap.body.topics, readerBootstrap.body.topics, "bootstrap topic map should be stable across clients");

  const baseline = await fetchSync(reader.access_token, initialCursor);
  const baselineCursor = baseline.body.next_since ?? initialCursor;

  const uniqueMarker = randomUUID().slice(0, 8);
  const createPost = await requestJson<CreatePostResponse>("/v1/posts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${writer.access_token}`,
    },
    body: JSON.stringify({
      community_id: communityId,
      post_type: "request",
      category: "food",
      title: `M6 smoke need pantry ${uniqueMarker}`,
      body: `Smoke overlay validation ${uniqueMarker}`,
      language: "en",
      location_zip: "11735",
      privacy: "community_only",
      expires_at: futureIso(6),
    }),
  });

  assert.equal(createPost.status, "active", `expected created post to be active, got ${createPost.status}`);
  assert.equal(createPost.risk_level, "low", `expected created post to be low risk, got ${createPost.risk_level}`);

  const delta = await waitForSyncEvent(reader.access_token, baselineCursor, (event) => {
    const syncedPost = event.payload?.post;
    return (
      event.event_type === "post.published" &&
      event.aggregate_type === "post" &&
      event.aggregate_id === createPost.post_id &&
      event.community_id === communityId &&
      syncedPost?.post_id === createPost.post_id
    );
  });

  const postPublished = delta.body.events.find((event) => event.aggregate_id === createPost.post_id);
  assert.ok(postPublished, "reader catch-up should include the new post.published event");
  assert.equal(postPublished.event_type, "post.published", "reader catch-up should return a post.published event");
  assert.equal(postPublished.topic, `weavenyc/${communityId}/posts`, "post event should use the posts topic");
  assert.equal(postPublished.payload?.post?.title, `M6 smoke need pantry ${uniqueMarker}`, "post payload should preserve the created title");
  assert.equal(postPublished.payload?.post?.p2p_version, 1, "newly published posts should start at p2p_version 1");
  assert.ok(postPublished.payload?.post?.ipfs_cid, "published posts should have ipfs_cid populated before sync replay");
  assert.ok(delta.body.latest_snapshot.event_count >= baseline.body.latest_snapshot.event_count + 1, "latest snapshot should advance after the write");

  const unseen = await fetchSync(reader.access_token, delta.body.next_since ?? baselineCursor);
  assert.equal(unseen.status, 200, "follow-up sync should return 200");
  assert.ok(unseen.body, "follow-up sync response body should exist");
  assert.equal(unseen.body.events.length, 0, "follow-up sync with next_since should return no unseen events");
  assert.equal(
    unseen.body.latest_snapshot.event_count,
    delta.body.latest_snapshot.event_count,
    "empty catch-up should preserve the latest snapshot event count",
  );

  const anchorToken = await createAnchorSession();
  const announcementTitle = `M6 smoke announcement ${uniqueMarker}`;
  const announcement = await requestJson<AnnouncementCreateResponse>(
    `/v1/admin/communities/${communityId}/announcements`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${anchorToken}`,
      },
      body: JSON.stringify({
        title: announcementTitle,
        body: "Announcement propagation check for M6 overlay smoke.",
        is_pinned: true,
      }),
    },
  );
  assert.equal(announcement.status, "active", "published announcement should be active");

  const announcementDelta = await waitForSyncEvent(reader.access_token, delta.body.next_since ?? baselineCursor, (event) => {
    return (
      event.event_type === "announcement.published" &&
      event.aggregate_type === "announcement" &&
      event.aggregate_id === announcement.announcement_id
    );
  });
  const announcementEvent = announcementDelta.body.events.find(
    (event) => event.event_type === "announcement.published" && event.aggregate_id === announcement.announcement_id,
  );
  assert.ok(announcementEvent, "reader catch-up should include the new announcement.published event");

  const report = await requestJson<ReportCreateResponse>("/v1/reports", {
    method: "POST",
    headers: {
      authorization: `Bearer ${reader.access_token}`,
    },
    body: JSON.stringify({
      target_type: "post",
      target_id: createPost.post_id,
      reason: "misinformation",
      evidence_description: "M6 overlay smoke report propagation check",
    }),
  });
  assert.equal(report.status, "new", "post report should be created as new");

  const reportDecision = await requestJson<ReportDecisionResponse>(
    `/v1/admin/report_queue/${report.report_id}/decision`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${anchorToken}`,
      },
      body: JSON.stringify({
        decision: "warn",
        notes: "M6 overlay smoke warning decision",
      }),
    },
  );
  assert.equal(reportDecision.status, "resolved", "report decision should resolve the report");
  assert.equal(reportDecision.resolution, "warn", "report decision should preserve the warn resolution");

  const moderationDelta = await waitForSyncEvent(reader.access_token, announcementDelta.body.next_since ?? baselineCursor, (event) => {
    return event.event_type === "moderation.decision" && event.payload?.report_id === report.report_id;
  });
  const reportCreated = moderationDelta.body.events.find(
    (event) => event.event_type === "report.created" && event.aggregate_id === report.report_id,
  );
  const moderationDecision = moderationDelta.body.events.find(
    (event) => event.event_type === "moderation.decision" && event.payload?.report_id === report.report_id,
  );
  assert.ok(reportCreated, "reader catch-up should include report.created");
  assert.ok(moderationDecision, "reader catch-up should include moderation.decision");
  assert.notEqual(
    moderationDecision?.aggregate_id,
    report.report_id,
    "moderation.decision should use moderation action identity, not report id",
  );

  const finalCatchUp = await fetchSync(reader.access_token, moderationDelta.body.next_since ?? baselineCursor);
  assert.equal(finalCatchUp.status, 200, "final catch-up should return 200");
  assert.equal(finalCatchUp.body.events.length, 0, "final catch-up should not replay seen events");

  console.log(
    JSON.stringify(
      {
        ok: true,
        strict: strictMode,
        checked: [
          "GET /healthz",
          "GET /readyz",
          "GET /v1/communities/:community_id/bootstrap (writer)",
          "GET /v1/communities/:community_id/bootstrap (reader)",
          "POST /v1/posts",
          "GET /v1/communities/:community_id/sync (baseline cursor)",
          "GET /v1/communities/:community_id/sync (post.published catch-up)",
          "POST /v1/admin/communities/:community_id/announcements",
          "GET /v1/communities/:community_id/sync (announcement.published catch-up)",
          "POST /v1/reports",
          "POST /v1/admin/report_queue/:report_id/decision",
          "GET /v1/communities/:community_id/sync (report / moderation catch-up)",
          "GET /v1/communities/:community_id/sync (empty unseen catch-up)",
        ],
        created_post_id: createPost.post_id,
        created_announcement_id: announcement.announcement_id,
        report_id: report.report_id,
        next_since: moderationDelta.body.next_since,
      },
      null,
      2,
    ),
  );
}

async function waitForReady() {
  const deadline = Date.now() + syncTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiBaseUrl}/readyz`, {
        signal: AbortSignal.timeout(1_500),
      });
      if (response.status === 200) {
        return;
      }
    } catch {
      // Keep polling until ready or timeout.
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting ${syncTimeoutMs}ms for ${apiBaseUrl}/readyz`);
}

async function waitForSyncEvent(
  accessToken: string,
  since: string,
  predicate: (event: SyncEvent) => boolean,
): Promise<{ status: number; body: SyncDeltaResponse }> {
  const deadline = Date.now() + syncTimeoutMs;
  let lastResponse: { status: number; body: SyncDeltaResponse } | null = null;

  while (Date.now() < deadline) {
    const response = await fetchSync(accessToken, since);
    lastResponse = response;
    if (response.body.events.some(predicate)) {
      return response;
    }
    await sleep(350);
  }

  throw new Error(
    `Timed out waiting for sync event after ${syncTimeoutMs}ms. Last delta contained ${lastResponse?.body.events.length ?? 0} event(s).`,
  );
}

async function expectOk(path: string) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    signal: AbortSignal.timeout(2_000),
  });
  assert.equal(response.status, 200, `${path} should return 200`);
}

async function createAnonymousSession() {
  const session = await requestJson<AuthSessionResponse>("/v1/auth/anonymous", {
    method: "POST",
    body: JSON.stringify({ device_id: randomUUID() }),
  });

  assert.ok(session.access_token, "anonymous session should return access_token");
  assert.ok(session.refresh_token, "anonymous session should return refresh_token");
  assert.equal(session.user.level, "anonymous", "anonymous session should return anonymous user level");
  return session;
}

async function createAnchorSession() {
  const anchorAnonymous = await createAnonymousSession();
  await joinCommunityByInvite(anchorAnonymous.access_token, communityId, seedValues.communityInviteCode);
  const smokePhone = `+1519${Date.now().toString().slice(-7)}`;

  const otpStart = await requestJson<OtpStartResponse>("/v1/auth/otp/start", {
    method: "POST",
    headers: {
      authorization: `Bearer ${anchorAnonymous.access_token}`,
    },
    body: JSON.stringify({
      phone: smokePhone,
    }),
  });
  assert.equal(otpStart.fallback, true, "anchor bootstrap should use stub OTP provider");
  assert.ok(otpStart.demo_code, "anchor bootstrap should expose demo OTP code");

  const verified = await requestJson<AuthSessionResponse>("/v1/auth/otp/verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${anchorAnonymous.access_token}`,
    },
    body: JSON.stringify({
      challenge_id: otpStart.challenge_id,
      code: otpStart.demo_code,
    }),
  });
  assert.equal(verified.user.level, "verified", "OTP verify should upgrade anchor bootstrap user to verified");

  const inviteCode = await createSmokeAnchorInvite();
  const activation = await requestJson<AnchorActivateResponse>("/v1/auth/anchor/activate", {
    method: "POST",
    headers: {
      authorization: `Bearer ${verified.access_token}`,
    },
    body: JSON.stringify({
      invite_code: inviteCode,
    }),
  });
  const totpSecret = readTotpSecret(activation.otpauth_uri);

  const confirmed = await requestJson<AuthSessionResponse>("/v1/auth/anchor/activate/confirm", {
    method: "POST",
    headers: {
      authorization: `Bearer ${verified.access_token}`,
    },
    body: JSON.stringify({
      activation_id: activation.activation_id,
      totp_code: generateTotpCode(totpSecret),
    }),
  });
  assert.equal(confirmed.user.level, "anchor", "anchor activate confirm should upgrade the user to anchor");

  const sessionStart = await requestJson<AnchorSessionStartResponse>("/v1/auth/anchor/session/start", {
    method: "POST",
    headers: {
      authorization: `Bearer ${confirmed.access_token}`,
    },
    body: JSON.stringify({
      community_id: communityId,
    }),
  });

  const sessionVerify = await requestJson<AuthSessionResponse>("/v1/auth/anchor/session/verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${confirmed.access_token}`,
    },
    body: JSON.stringify({
      challenge_id: sessionStart.challenge_id,
      totp_code: generateTotpCode(totpSecret),
    }),
  });
  assert.equal(sessionVerify.user.level, "anchor", "step-up session should keep anchor level");
  return sessionVerify.access_token;
}

async function createSmokeAnchorInvite() {
  const config = await loadConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
  });
  const inviteCode = `M6-ANCHOR-${randomUUID().replaceAll("-", "").slice(0, 8)}`;

  try {
    await pool.query(
      `
        insert into anchor_invites (
          anchor_invite_id,
          community_id,
          code_hash,
          org_name,
          status,
          created_at
        )
        values ($1, $2, $3, $4, 'active', now())
        on conflict (code_hash) do update
        set
          community_id = excluded.community_id,
          org_name = excluded.org_name,
          status = 'active',
          expires_at = null,
          consumed_by_user_id = null,
          consumed_at = null
      `,
      [
        randomUUID(),
        communityId,
        hashInviteCode(inviteCode),
        "St. Kilian Parish Social Ministry",
      ],
    );
  } finally {
    await pool.end();
  }

  return inviteCode;
}

async function joinCommunityByInvite(accessToken: string, targetCommunityId: string, inviteCode: string) {
  const resolved = await requestJson<CommunityResolveResponse>("/v1/community-access/resolve", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ invite_code: inviteCode }),
  });
  assert.equal(resolved.community.community_id, targetCommunityId, "invite resolve should return the expected community");

  const joined = await requestJson<JoinCommunityResponse>(`/v1/communities/${targetCommunityId}/join`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ join_token: resolved.join_token }),
  });
  assert.ok(
    joined.membership_status === "joined" || joined.membership_status === "already_joined",
    `join should be idempotent, got ${joined.membership_status}`,
  );
  return joined;
}

async function fetchSync(accessToken: string, since: string): Promise<{ status: number; body: SyncDeltaResponse }> {
  const response = await fetchOptionalJson<SyncDeltaResponse>(
    `/v1/communities/${communityId}/sync?since=${encodeURIComponent(since)}&limit=100`,
    accessToken,
  );
  assert.equal(response.status, 200, "sync should return 200");
  assert.ok(response.body, "sync response body should exist");
  assert.ok(Array.isArray(response.body.events), "sync events should be an array");
  assert.equal(typeof response.body.server_time, "string", "sync server_time should be a string");
  assert.equal(typeof response.body.latest_snapshot.event_count, "number", "sync snapshot event_count should be numeric");
  return {
    status: response.status,
    body: response.body,
  };
}

async function fetchOptionalJson<T>(path: string, accessToken?: string): Promise<{ status: number; body: T | null }> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: accessToken
      ? {
          authorization: `Bearer ${accessToken}`,
        }
      : undefined,
    signal: AbortSignal.timeout(4_000),
  });

  if (response.status === 404) {
    return { status: 404, body: null };
  }

  const text = await response.text();
  const body = text.length > 0 ? (JSON.parse(text) as T) : null;
  return {
    status: response.status,
    body,
  };
}

async function requestJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(4_000),
  });

  const text = await response.text();
  assert.ok(response.ok, `${path} should return 2xx, got ${response.status}: ${text}`);
  return JSON.parse(text) as T;
}

async function resetAuthAbuseState() {
  const config = await loadConfig();
  await clearRedisAuthAbuseKeys(config.redisUrl);
}

async function resetCommunitySyncEvents() {
  const config = await loadConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
  });

  try {
    await pool.query(`delete from community_sync_events where community_id = $1`, [communityId]);
  } finally {
    await pool.end();
  }
}

function hashInviteCode(inviteCode: string) {
  return createHash("sha256").update(inviteCode.trim().toUpperCase()).digest("hex");
}

function readTotpSecret(otpauthUri: string) {
  const url = new URL(otpauthUri);
  const secret = url.searchParams.get("secret");
  assert.ok(secret, "TOTP secret missing from otpauth URI");
  return secret;
}

function generateTotpCode(secret: string, now = Date.now()) {
  const decoded = decodeBase32(secret);
  const counter = Math.floor(now / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decoded).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = base32Alphabet.indexOf(char);
    assert(index >= 0, "Invalid base32 secret");
    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function futureIso(hoursAhead: number) {
  return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
