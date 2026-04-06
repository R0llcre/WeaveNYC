import { randomUUID } from 'node:crypto';
import process from 'node:process';

import { seedIds } from '../../packages/db/seed/fixtures.js';
import { loadConfig } from '../../services/api-gateway/src/config.js';
import { mintDevAccessToken } from '../../services/api-gateway/src/lib/dev-access-tokens.js';

type AuthSessionResponse = {
  access_token: string;
  refresh_token: string;
  issued_via?: string;
  fallback?: boolean;
  user: {
    user_id: string;
    level: string;
  };
};

type OtpStartResponse = {
  challenge_id: string;
  fallback: boolean;
  demo_code?: string;
};

type MagicLinkStartResponse = {
  challenge_id: string;
  fallback: boolean;
  demo_token?: string;
};

type CommunityResolveResponse = {
  community: {
    community_id: string;
    name: string;
  };
  join_token: string;
  entry: 'invite_code' | 'qr_token';
};

type JoinCommunityResponse = {
  community_id: string;
  membership_status: 'joined' | 'already_joined';
};

type CreatePostResponse = {
  post_id: string;
  status: string;
  risk_level: string;
};

type PostsListResponse = {
  items: Array<{
    post_id: string;
    privacy: string;
    status: string;
    title: string;
  }>;
  next_cursor: string | null;
};

type PostDetailResponse = {
  post_id: string;
  status: string;
  privacy: string;
  title: string;
  actions: {
    can_edit: boolean;
    can_close: boolean;
    can_delete: boolean;
    can_review: boolean;
  };
};

type ReviewQueueResponse = {
  items: Array<{
    post_id: string;
    title: string;
    status: string;
  }>;
};

type ReviewDecisionResponse = {
  post_id: string;
  status: string;
};

type ResourceListResponse = {
  items: Array<{
    provider_id: string;
    name: string;
  }>;
};

type ResourceDetailResponse = {
  provider_id: string;
  weekly_hours: unknown[];
};

const apiBaseUrl = (process.env.WEAVENYC_API_BASE_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const smokeZip = process.env.WEAVENYC_SMOKE_ZIP ?? '11735';
const minResources = Number(process.env.WEAVENYC_SMOKE_MIN_RESOURCES ?? '3');
const startupTimeoutMs = Number(process.env.WEAVENYC_SMOKE_TIMEOUT_MS ?? '60000');
const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const smokePhone = `+1516${runId.slice(-7)}`;
const smokeEmail = `neighbor+${runId}@example.com`;

async function main() {
  await waitForReady();

  const health = await fetchJson('/healthz');
  assert(health.response.status === 200, `Expected GET /healthz to return 200, got ${health.response.status}`);

  const ready = await fetchJson('/readyz');
  assert(ready.response.status === 200, `Expected GET /readyz to return 200, got ${ready.response.status}`);

  const anonymous = await createAnonymousSession();

  const resolveInvite = await fetchJson<CommunityResolveResponse>('/v1/community-access/resolve', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${anonymous.body.access_token}`,
    },
    body: JSON.stringify({
      invite_code: 'FARMINGDALE-HELP',
    }),
  });
  assert(resolveInvite.response.status === 200, `Expected invite resolve to return 200, got ${resolveInvite.response.status}`);
  assert(resolveInvite.body?.community.community_id === seedIds.communityId, 'Invite resolve returned the wrong community');

  const joinInvite = await fetchJson<JoinCommunityResponse>(`/v1/communities/${seedIds.communityId}/join`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${anonymous.body.access_token}`,
    },
    body: JSON.stringify({
      join_token: resolveInvite.body.join_token,
    }),
  });
  assert(joinInvite.response.status === 200, `Expected invite join to return 200, got ${joinInvite.response.status}`);
  assert(joinInvite.body?.membership_status === 'joined', `Expected invite join to return joined, got ${joinInvite.body?.membership_status ?? '<missing>'}`);

  const resolveQr = await fetchJson<CommunityResolveResponse>('/v1/community-access/resolve', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${anonymous.body.access_token}`,
    },
    body: JSON.stringify({
      qr_token: 'FARMINGDALE-QR',
    }),
  });
  assert(resolveQr.response.status === 200, `Expected QR resolve to return 200, got ${resolveQr.response.status}`);
  assert(resolveQr.body?.entry === 'qr_token', `Expected QR resolve entry to be qr_token, got ${resolveQr.body?.entry ?? '<missing>'}`);

  const joinQr = await fetchJson<JoinCommunityResponse>(`/v1/communities/${seedIds.communityId}/join`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${anonymous.body.access_token}`,
    },
    body: JSON.stringify({
      join_token: resolveQr.body.join_token,
    }),
  });
  assert(joinQr.response.status === 200, `Expected QR join to return 200, got ${joinQr.response.status}`);
  assert(joinQr.body?.membership_status === 'already_joined', `Expected QR join replay to be already_joined, got ${joinQr.body?.membership_status ?? '<missing>'}`);

  const requestCreate = await fetchJson<CreatePostResponse>('/v1/posts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${anonymous.body.access_token}`,
    },
    body: JSON.stringify({
      community_id: seedIds.communityId,
      post_type: 'request',
      category: 'food',
      title: 'Need groceries for tonight',
      body: 'Need help with groceries for tonight.',
      language: 'en',
      location_zip: smokeZip,
      privacy: 'public',
      expires_at: futureIso(24),
      contact_pref: {
        in_app_chat: true,
        call: false,
        text: false,
      },
    }),
  });
  assert(requestCreate.response.status === 200, `Expected request post create to return 200, got ${requestCreate.response.status}`);
  assert(requestCreate.body?.status === 'active', `Expected low-risk request to be active, got ${requestCreate.body?.status ?? '<missing>'}`);

  const requestPostId = requestCreate.body.post_id;

  const communityFeed = await fetchJson<PostsListResponse>(`/v1/posts?scope=community&community_id=${seedIds.communityId}`, {
    headers: {
      authorization: `Bearer ${anonymous.body.access_token}`,
    },
  });
  assert(communityFeed.response.status === 200, `Expected community feed to return 200, got ${communityFeed.response.status}`);
  assert(communityFeed.body?.items.some((post) => post.post_id === requestPostId), 'Community feed did not include the new request post');

  const requestDetail = await fetchJson<PostDetailResponse>(`/v1/posts/${requestPostId}`, {
    headers: {
      authorization: `Bearer ${anonymous.body.access_token}`,
    },
  });
  assert(requestDetail.response.status === 200, `Expected post detail to return 200, got ${requestDetail.response.status}`);
  assert(requestDetail.body?.actions.can_edit === true, 'Request owner did not receive edit permissions');

  const refreshed = await fetchJson<AuthSessionResponse>('/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({
      refresh_token: anonymous.body.refresh_token,
    }),
  });
  assert(refreshed.response.status === 200, `Expected POST /v1/auth/refresh to return 200, got ${refreshed.response.status}`);
  assert(refreshed.body?.refresh_token !== anonymous.body.refresh_token, 'Refresh rotation did not mint a new refresh token');

  const replayedRefresh = await fetchJson<{ message?: string }>('/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({
      refresh_token: anonymous.body.refresh_token,
    }),
  });
  assert(replayedRefresh.response.status === 401, `Expected replayed refresh token to return 401, got ${replayedRefresh.response.status}`);

  const otpStart = await fetchJson<OtpStartResponse>('/v1/auth/otp/start', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${refreshed.body.access_token}`,
    },
    body: JSON.stringify({
      phone: smokePhone,
    }),
  });
  assert(otpStart.response.status === 200, `Expected POST /v1/auth/otp/start to return 200, got ${otpStart.response.status}`);
  assert(otpStart.body?.fallback === true, 'OTP smoke expected stub provider fallback');
  assert(Boolean(otpStart.body?.demo_code), 'OTP smoke expected stub demo_code');

  const otpVerify = await fetchJson<AuthSessionResponse>('/v1/auth/otp/verify', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${refreshed.body.access_token}`,
    },
    body: JSON.stringify({
      challenge_id: otpStart.body.challenge_id,
      code: otpStart.body.demo_code,
    }),
  });
  assert(otpVerify.response.status === 200, `Expected POST /v1/auth/otp/verify to return 200, got ${otpVerify.response.status}`);
  assert(otpVerify.body?.user.level === 'verified', `Expected OTP verify to upgrade user to verified, got ${otpVerify.body?.user.level ?? '<missing>'}`);

  const offerCreate = await fetchJson<CreatePostResponse>('/v1/posts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${otpVerify.body.access_token}`,
    },
    body: JSON.stringify({
      community_id: seedIds.communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share extra groceries',
      body: 'Can share groceries this evening.',
      language: 'en',
      location_zip: smokeZip,
      privacy: 'community_only',
      expires_at: futureIso(24),
      contact_pref: {
        in_app_chat: true,
        call: false,
        text: true,
      },
    }),
  });
  assert(offerCreate.response.status === 200, `Expected offer create to return 200, got ${offerCreate.response.status}`);
  assert(offerCreate.body?.status === 'active', `Expected verified low-risk offer to be active, got ${offerCreate.body?.status ?? '<missing>'}`);

  const anchorMediatedCreate = await fetchJson<CreatePostResponse>('/v1/posts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${otpVerify.body.access_token}`,
    },
    body: JSON.stringify({
      community_id: seedIds.communityId,
      post_type: 'request',
      category: 'food',
      title: 'Need mediated groceries',
      body: 'Need mediated help with groceries this week.',
      language: 'en',
      location_zip: smokeZip,
      privacy: 'anchor_mediated',
      expires_at: futureIso(24),
      contact_pref: {
        in_app_chat: true,
        call: false,
        text: false,
      },
    }),
  });
  assert(anchorMediatedCreate.response.status === 200, `Expected anchor mediated create to return 200, got ${anchorMediatedCreate.response.status}`);
  assert(anchorMediatedCreate.body?.status === 'active', `Expected low-risk anchor mediated post to be active, got ${anchorMediatedCreate.body?.status ?? '<missing>'}`);

  const highRiskOffer = await fetchJson<CreatePostResponse>('/v1/posts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${otpVerify.body.access_token}`,
    },
    body: JSON.stringify({
      community_id: seedIds.communityId,
      post_type: 'offer',
      category: 'transportation',
      title: 'Can drive someone to a pantry',
      body: 'Can drive someone alone after school today.',
      language: 'en',
      location_zip: smokeZip,
      privacy: 'community_only',
      expires_at: futureIso(24),
      contact_pref: {
        in_app_chat: true,
        call: true,
        text: false,
      },
    }),
  });
  assert(highRiskOffer.response.status === 200, `Expected high-risk offer create to return 200, got ${highRiskOffer.response.status}`);
  assert(highRiskOffer.body?.status === 'pending_review', `Expected high-risk offer to enter pending_review, got ${highRiskOffer.body?.status ?? '<missing>'}`);

  const anchorToken = await mintAnchorToken();
  const reviewQueue = await fetchJson<ReviewQueueResponse>(`/v1/admin/review_queue?community_id=${seedIds.communityId}`, {
    headers: {
      authorization: `Bearer ${anchorToken}`,
    },
  });
  assert(reviewQueue.response.status === 200, `Expected review queue to return 200, got ${reviewQueue.response.status}`);
  assert(reviewQueue.body?.items.some((post) => post.post_id === highRiskOffer.body.post_id), 'Review queue did not include the pending high-risk post');

  const approveDecision = await fetchJson<ReviewDecisionResponse>(`/v1/admin/review_queue/${highRiskOffer.body.post_id}/decision`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${anchorToken}`,
    },
    body: JSON.stringify({
      decision: 'approve',
      notes: 'Approved during smoke test',
    }),
  });
  assert(approveDecision.response.status === 200, `Expected review decision to return 200, got ${approveDecision.response.status}`);
  assert(approveDecision.body?.status === 'active', `Expected approved review decision to activate the post, got ${approveDecision.body?.status ?? '<missing>'}`);

  const publicFeed = await fetchJson<PostsListResponse>('/v1/posts?scope=public', {
    headers: {
      authorization: `Bearer ${otpVerify.body.access_token}`,
    },
  });
  assert(publicFeed.response.status === 200, `Expected public feed to return 200, got ${publicFeed.response.status}`);
  assert(publicFeed.body?.items.some((post) => post.post_id === requestPostId), 'Public feed did not include the public request post');
  assert(publicFeed.body?.items.every((post) => post.privacy === 'public'), 'Public feed returned a non-public post');
  assert(
    publicFeed.body?.items.every((post) => post.post_id !== anchorMediatedCreate.body.post_id),
    'Public feed should not include anchor_mediated posts',
  );

  const verifiedCommunityFeed = await fetchJson<PostsListResponse>(`/v1/posts?scope=community&community_id=${seedIds.communityId}`, {
    headers: {
      authorization: `Bearer ${otpVerify.body.access_token}`,
    },
  });
  assert(verifiedCommunityFeed.response.status === 200, `Expected verified community feed to return 200, got ${verifiedCommunityFeed.response.status}`);
  assert(
    verifiedCommunityFeed.body?.items.every((post) => post.post_id !== anchorMediatedCreate.body.post_id),
    'Community feed should not include anchor_mediated posts',
  );

  const meUnauthorized = await fetchRaw('/v1/me');
  assert(meUnauthorized.status === 401, `Expected GET /v1/me without token to return 401, got ${meUnauthorized.status}`);

  const meAuthorized = await fetchJson('/v1/me', {
    headers: {
      authorization: `Bearer ${otpVerify.body.access_token}`,
    },
  });
  assert(meAuthorized.response.status === 200, `Expected GET /v1/me with token to return 200, got ${meAuthorized.response.status}`);

  const magicLinkSession = await createAnonymousSession();
  const magicLinkStart = await fetchJson<MagicLinkStartResponse>('/v1/auth/magic-link/start', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${magicLinkSession.body.access_token}`,
    },
    body: JSON.stringify({
      email: smokeEmail,
    }),
  });
  assert(magicLinkStart.response.status === 200, `Expected POST /v1/auth/magic-link/start to return 200, got ${magicLinkStart.response.status}`);
  assert(magicLinkStart.body?.fallback === true, 'Magic-link smoke expected stub provider fallback');
  assert(Boolean(magicLinkStart.body?.demo_token), 'Magic-link smoke expected stub demo_token');

  const magicLinkVerify = await fetchJson<AuthSessionResponse>('/v1/auth/magic-link/verify', {
    method: 'POST',
    body: JSON.stringify({
      challenge_id: magicLinkStart.body.challenge_id,
      token: magicLinkStart.body.demo_token,
    }),
  });
  assert(magicLinkVerify.response.status === 200, `Expected POST /v1/auth/magic-link/verify to return 200, got ${magicLinkVerify.response.status}`);
  assert(magicLinkVerify.body?.user.level === 'verified', `Expected magic-link verify to upgrade user to verified, got ${magicLinkVerify.body?.user.level ?? '<missing>'}`);

  const resources = await fetchJson<ResourceListResponse>(`/v1/resources?zip=${encodeURIComponent(smokeZip)}&limit=5`);
  assert(resources.response.status === 200, `Expected GET /v1/resources to return 200, got ${resources.response.status}`);
  assert(
    Array.isArray(resources.body?.items) && resources.body.items.length >= minResources,
    `Expected at least ${minResources} resources for ZIP ${smokeZip}, got ${resources.body?.items?.length ?? 0}`,
  );

  const providerId = resources.body.items[0]?.provider_id;
  assert(Boolean(providerId), 'Resource list did not include a provider_id');

  const detail = await fetchJson<ResourceDetailResponse>(
    `/v1/resources/${encodeURIComponent(providerId)}?zip=${encodeURIComponent(smokeZip)}`,
  );
  assert(detail.response.status === 200, `Expected GET /v1/resources/:provider_id to return 200, got ${detail.response.status}`);
  assert(Array.isArray(detail.body?.weekly_hours), 'Resource detail did not include weekly_hours');

  const docs = await fetchRaw('/docs');
  assert(docs.status === 200, `Expected GET /docs to return 200, got ${docs.status}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiBaseUrl,
        smokeZip,
        checked: [
          'GET /healthz',
          'GET /readyz',
          'POST /v1/auth/anonymous',
          'POST /v1/community-access/resolve (invite)',
          'POST /v1/communities/:community_id/join (invite)',
          'POST /v1/community-access/resolve (qr)',
          'POST /v1/communities/:community_id/join (qr replay)',
          'POST /v1/posts (anonymous public request)',
          'GET /v1/posts?scope=community',
          'GET /v1/posts/:post_id',
          'POST /v1/auth/refresh',
          'POST /v1/auth/refresh (replay -> 401)',
          'POST /v1/auth/otp/start',
          'POST /v1/auth/otp/verify',
          'POST /v1/posts (verified low-risk offer)',
          'POST /v1/posts (verified low-risk anchor_mediated request)',
          'POST /v1/posts (verified high-risk offer -> pending_review)',
          'GET /v1/admin/review_queue',
          'POST /v1/admin/review_queue/:post_id/decision',
          'GET /v1/posts?scope=public',
          'GET /v1/posts?scope=community (verified, anchor_mediated excluded)',
          'GET /v1/me (401)',
          'GET /v1/me (200)',
          'POST /v1/auth/magic-link/start',
          'POST /v1/auth/magic-link/verify',
          'GET /v1/resources',
          'GET /v1/resources/:provider_id',
          'GET /docs',
        ],
        requestPostId,
        approvedPostId: highRiskOffer.body.post_id,
        resourceCount: resources.body.items.length,
        providerId,
      },
      null,
      2,
    ),
  );
}

async function createAnonymousSession() {
  const anonymous = await fetchJson<AuthSessionResponse>('/v1/auth/anonymous', {
    method: 'POST',
    body: JSON.stringify({
      device_id: randomUUID(),
    }),
  });
  assert(anonymous.response.status === 200, `Expected POST /v1/auth/anonymous to return 200, got ${anonymous.response.status}`);
  assert(Boolean(anonymous.body?.access_token), 'Anonymous session did not return access_token');
  assert(Boolean(anonymous.body?.refresh_token), 'Anonymous session did not return refresh_token');
  assert(anonymous.body?.user.level === 'anonymous', `Expected anonymous level, got ${anonymous.body?.user.level ?? '<missing>'}`);
  return anonymous;
}

async function mintAnchorToken() {
  const config = await loadConfig();
  return mintDevAccessToken(config, {
    sub: seedIds.anchorUserId,
    level: 'anchor',
    role: 'anchor',
    community_ids: [seedIds.communityId],
  });
}

function futureIso(hoursAhead: number) {
  return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
}

async function waitForReady() {
  const deadline = Date.now() + startupTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetchRaw('/readyz');
      if (response.status === 200) {
        return;
      }
    } catch {
      // Wait for API bootstrap.
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting ${startupTimeoutMs}ms for ${apiBaseUrl}/readyz`);
}

async function fetchJson<T = unknown>(path: string, init: RequestInit = {}) {
  const response = await fetchRaw(path, init);
  const body = (await response.json()) as T;
  return { response, body };
}

async function fetchRaw(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
