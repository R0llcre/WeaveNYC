import { createHash, createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';

import { Pool } from 'pg';
import { WebSocket, type RawData } from 'ws';
import { seedIds, seedValues } from '../../packages/db/seed/fixtures.js';
import { loadConfig } from '../../services/api-gateway/src/config.js';
import { clearRedisAuthAbuseKeys } from '../../services/api-gateway/src/lib/identity.js';

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

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
    report_id?: string;
    post_id: string;
    title: string;
    status: string;
    community_id?: string;
    reason?: string;
    priority?: string;
  }>;
};

type ReviewDecisionResponse = {
  post_id: string;
  status: string;
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

type AnchorSessionVerifyResponse = AuthSessionResponse;

type AdminReportQueueResponse = {
  items: Array<{
    report_id: string;
    community_id: string;
    target_type: 'post' | 'user' | 'message';
    target_id: string;
    reason: string;
    status: 'new' | 'resolved' | 'dismissed';
    created_at: string;
    reporter_user_id: string;
    reporter_alias: string;
    priority: 'P0' | 'P1' | 'P2';
    conversation_id: string | null;
    evidence_description: string | null;
  }>;
  next_cursor: string | null;
};

type AdminReportDecisionResponse = {
  report_id: string;
  status: 'new' | 'resolved' | 'dismissed';
  resolution: 'remove_post' | 'suspend_user' | 'warn' | 'none';
  decided_at: string;
};

type CommunityRulesResponse = {
  community_id: string;
  review_categories: Array<'food' | 'goods' | 'childcare' | 'companionship' | 'translation' | 'transportation' | 'other'>;
  auto_hide_report_threshold: number;
  keyword_blocklist: string[];
  language_preferences: Array<'en' | 'es' | 'zh'>;
  announcement_pin_strategy: 'latest' | 'manual';
  updated_at: string;
};

type AnnouncementCreateResponse = {
  announcement_id: string;
  community_id: string;
  title: string;
  body: string;
  status: 'active' | 'deleted';
  is_pinned: boolean;
  published_at: string;
  updated_at: string;
  created_by: string;
};

type CommunityAnnouncementsApiResponse = {
  items: Array<{
    announcement_id: string;
    community_id: string;
    title: string;
    body: string;
    status: 'active' | 'deleted';
    is_pinned: boolean;
    published_at: string;
    updated_at: string;
    created_by: string;
  }>;
};

type MatchResultsApiResponse = {
  post_id: string;
  batch_number: number;
  advanced: boolean;
  refreshes_used: number;
  max_refreshes: number;
  items: Array<{
    candidate_type: 'neighbor_post' | 'official_resource';
    candidate_id: string;
  }>;
};

type MatchContactApiResponse = {
  contact_request_id: string;
  status: 'pending' | 'accepted';
  conversation_id?: string;
};

type ContactRequestsInboxApiResponse = {
  items: Array<{
    contact_request_id: string;
    requester_alias: string;
    status: string;
  }>;
  next_cursor: string | null;
};

type ContactRequestDecisionApiResponse = {
  contact_request_id: string;
  status: 'accepted' | 'rejected';
  responded_at: string;
  conversation_id?: string;
};

type ConversationsListApiResponse = {
  items: Array<{
    conversation_id: string;
    status: 'active' | 'closed' | 'blocked';
  }>;
  next_cursor: string | null;
};

type ConversationDetailApiResponse = {
  conversation_id: string;
  contact_request_id: string;
  related_post_ids: string[];
  participant_preview: Array<{
    user_id: string;
    alias: string;
  }>;
  status: 'active' | 'closed' | 'blocked';
  created_at: string;
  last_activity_at: string;
  last_message_preview: string | null;
  unread_count: number;
  other_user_id: string;
  actions: {
    can_send: boolean;
    can_close: boolean;
    can_block: boolean;
    can_report: boolean;
  };
};

type ConversationMessagesApiResponse = {
  items: Array<{
    message_id: string;
    body: string;
    is_mine: boolean;
    sender_alias: string;
    safety_flags: string[];
  }>;
  next_cursor: string | null;
};

type SendConversationMessageApiResponse = {
  conversation_id: string;
  message: {
    message_id: string;
    body: string;
    is_mine: boolean;
  };
};

type ReportCreateApiResponse = {
  report_id: string;
  status: 'new';
  created_at: string;
};

type BlockUserApiResponse = {
  blocked_user_id: string;
  status: 'blocked';
  blocked_at: string;
  affected_conversation_ids: string[];
};

type CloseConversationApiResponse = {
  conversation_id: string;
  status: 'closed';
  closed_at: string;
};

type ChatRealtimeSmokeEvent =
  | {
      event_type: 'message.created';
      conversation_id: string;
      message: {
        body: string;
        is_mine: boolean;
      };
    }
  | {
      event_type: 'conversation.updated';
      conversation: {
        conversation_id: string;
        unread_count: number;
        status: 'active' | 'closed' | 'blocked';
      };
    }
  | {
      event_type: 'heartbeat';
    };

type RuntimeWebSocket = WebSocket;

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

type AccountDeleteRequestResponse = {
  challenge_id: string;
  masked_destination: string;
  delivery_channel: 'sms' | 'email';
  expires_in_seconds: number;
  fallback?: boolean;
  demo_code?: string;
  demo_token?: string;
  demo_url?: string;
};

type AccountDeleteConfirmResponse = {
  status: 'deletion_scheduled';
  purge_date: string;
  user_id: string;
  undelete_recovery_token: string;
};

type AccountUndeleteResponse = {
  status: 'restored';
  user_id: string;
};

type AnchorSessionRecoveryErrorResponse = {
  message: string;
  remaining_attempts?: number;
};

const apiBaseUrl = (process.env.WEAVENYC_API_BASE_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const smokeZip = process.env.WEAVENYC_SMOKE_ZIP ?? '11735';
const minResources = Number(process.env.WEAVENYC_SMOKE_MIN_RESOURCES ?? '3');
const startupTimeoutMs = Number(process.env.WEAVENYC_SMOKE_TIMEOUT_MS ?? '60000');
const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const smokePhone = `+1516${runId.slice(-7)}`;
const smokeEmail = `neighbor+${runId}@example.com`;
const m3RequesterPhone = `+1517${runId.slice(-7)}`;
const m3HelperThreePhone = `+1518${runId.slice(-7)}`;

async function main() {
  await waitForReady();
  await resetAuthAbuseState();

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
      expires_at: futureIso(1),
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

  const m5AnchorAnonymous = await createAnonymousSession();
  const m5AnchorInvite = await createSmokeAnchorInvite();
  await joinCommunityByInvite(m5AnchorAnonymous.body.access_token, seedIds.communityId, seedValues.communityInviteCode);
  const m5AnchorOtpStart = await fetchJson<OtpStartResponse>('/v1/auth/otp/start', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${m5AnchorAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      phone: `+1519${runId.slice(-7)}`,
    }),
  });
  assert(m5AnchorOtpStart.response.status === 200, `Expected M5 anchor OTP start to return 200, got ${m5AnchorOtpStart.response.status}`);
  assert(Boolean(m5AnchorOtpStart.body?.demo_code), 'Expected M5 anchor OTP start to include demo_code');

  const m5AnchorVerified = await fetchJson<AuthSessionResponse>('/v1/auth/otp/verify', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${m5AnchorAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      challenge_id: m5AnchorOtpStart.body.challenge_id,
      code: m5AnchorOtpStart.body.demo_code,
    }),
  });
  assert(m5AnchorVerified.response.status === 200, `Expected M5 anchor OTP verify to return 200, got ${m5AnchorVerified.response.status}`);
  assert(m5AnchorVerified.body?.user.level === 'verified', `Expected M5 anchor OTP verify to return verified, got ${m5AnchorVerified.body?.user.level ?? '<missing>'}`);

  const anchorActivation = await fetchJson<AnchorActivateResponse>('/v1/auth/anchor/activate', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${m5AnchorVerified.body.access_token}`,
    },
    body: JSON.stringify({
      invite_code: m5AnchorInvite.inviteCode,
    }),
  });
  assert(anchorActivation.response.status === 200, `Expected anchor activation to return 200, got ${anchorActivation.response.status}`);
  assert(anchorActivation.body?.community.community_id === seedIds.communityId, 'Anchor activation returned the wrong community');

  const anchorTotpSecret = readTotpSecret(anchorActivation.body.otpauth_uri);
  const anchorConfirm = await fetchJson<AuthSessionResponse>('/v1/auth/anchor/activate/confirm', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${m5AnchorVerified.body.access_token}`,
    },
    body: JSON.stringify({
      activation_id: anchorActivation.body.activation_id,
      totp_code: generateTotpCode(anchorTotpSecret),
    }),
  });
  assert(anchorConfirm.response.status === 200, `Expected anchor activation confirm to return 200, got ${anchorConfirm.response.status}`);
  assert(anchorConfirm.body?.user.level === 'anchor', `Expected confirmed anchor level, got ${anchorConfirm.body?.user.level ?? '<missing>'}`);
  assert(anchorConfirm.body?.issued_via === 'anchor_activate', `Expected issued_via=anchor_activate, got ${anchorConfirm.body?.issued_via ?? '<missing>'}`);

  const anchorStepUpStart = await fetchJson<AnchorSessionStartResponse>('/v1/auth/anchor/session/start', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${anchorConfirm.body.access_token}`,
    },
    body: JSON.stringify({
      community_id: seedIds.communityId,
    }),
  });
  assert(anchorStepUpStart.response.status === 200, `Expected anchor session start to return 200, got ${anchorStepUpStart.response.status}`);

  const anchorStepUp = await fetchJson<AnchorSessionVerifyResponse>('/v1/auth/anchor/session/verify', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${anchorConfirm.body.access_token}`,
    },
    body: JSON.stringify({
      challenge_id: anchorStepUpStart.body.challenge_id,
      totp_code: generateTotpCode(anchorTotpSecret),
    }),
  });
  assert(anchorStepUp.response.status === 200, `Expected anchor session verify to return 200, got ${anchorStepUp.response.status}`);
  assert(anchorStepUp.body?.user.level === 'anchor', `Expected anchor session verify to keep anchor level, got ${anchorStepUp.body?.user.level ?? '<missing>'}`);
  assert(anchorStepUp.body?.issued_via === 'anchor_session', `Expected issued_via=anchor_session, got ${anchorStepUp.body?.issued_via ?? '<missing>'}`);

  const anchorToken = anchorStepUp.body.access_token;
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

  const reportQueue = await fetchJson<AdminReportQueueResponse>(`/v1/admin/report_queue?community_id=${seedIds.communityId}`, {
    headers: {
      authorization: `Bearer ${anchorToken}`,
    },
  });
  assert(reportQueue.response.status === 200, `Expected report queue to return 200, got ${reportQueue.response.status}`);
  let reportIdForDecision = seedIds.reportId;
  const seedReport = reportQueue.body?.items.find((item) => item.report_id === seedIds.reportId);
  if (!seedReport) {
    const fallbackReport = await fetchJson<ReportCreateApiResponse>('/v1/reports', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${otpVerify.body.access_token}`,
      },
      body: JSON.stringify({
        target_type: 'post',
        target_id: seedIds.offerPostId,
        reason: 'scam',
        evidence_description: 'Repeatable smoke fallback report',
      }),
    });
    assert(
      fallbackReport.response.status === 200,
      `Expected fallback report create to return 200, got ${fallbackReport.response.status}`,
    );
    reportIdForDecision = fallbackReport.body.report_id;

    const refreshedReportQueue = await fetchJson<AdminReportQueueResponse>(
      `/v1/admin/report_queue?community_id=${seedIds.communityId}`,
      {
        headers: {
          authorization: `Bearer ${anchorToken}`,
        },
      },
    );
    assert(
      refreshedReportQueue.body?.items.some((item) => item.report_id === reportIdForDecision),
      'Report queue did not include the fallback report',
    );
  }

  const reportDecision = await fetchJson<AdminReportDecisionResponse>(`/v1/admin/report_queue/${reportIdForDecision}/decision`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${anchorToken}`,
    },
    body: JSON.stringify({
      decision: 'warn',
      notes: 'Warning issued during smoke test',
    }),
  });
  assert(reportDecision.response.status === 200, `Expected report decision to return 200, got ${reportDecision.response.status}`);
  assert(reportDecision.body?.resolution === 'warn', `Expected report resolution warn, got ${reportDecision.body?.resolution ?? '<missing>'}`);
  assert(reportDecision.body?.status === 'resolved', `Expected report status resolved, got ${reportDecision.body?.status ?? '<missing>'}`);

  const rulesUpdate = await fetchJson<CommunityRulesResponse>(`/v1/admin/communities/${seedIds.communityId}/rules`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${anchorToken}`,
    },
    body: JSON.stringify({
      review_categories: ['goods'],
      auto_hide_report_threshold: 2,
      keyword_blocklist: ['cash only'],
      language_preferences: ['en', 'es', 'zh'],
      announcement_pin_strategy: 'manual',
    }),
  });
  assert(rulesUpdate.response.status === 200, `Expected rules update to return 200, got ${rulesUpdate.response.status}`);
  assert(
    rulesUpdate.body?.review_categories.includes('goods'),
    `Expected rules update to include goods, got ${rulesUpdate.body?.review_categories.join(', ') ?? '<missing>'}`,
  );

  const announcementTitle = `M5 smoke announcement ${runId}`;
  const publishAnnouncement = await fetchJson<AnnouncementCreateResponse>(`/v1/admin/communities/${seedIds.communityId}/announcements`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${anchorToken}`,
    },
    body: JSON.stringify({
      title: announcementTitle,
      body: 'M5 smoke announcement body.',
      is_pinned: true,
    }),
  });
  assert(publishAnnouncement.response.status === 200, `Expected announcement publish to return 200, got ${publishAnnouncement.response.status}`);
  assert(publishAnnouncement.body?.title === announcementTitle, 'Announcement publish returned the wrong title');

  const communityAnnouncements = await fetchJson<CommunityAnnouncementsApiResponse>(`/v1/communities/${seedIds.communityId}/announcements`, {
    headers: {
      authorization: `Bearer ${anchorToken}`,
    },
  });
  assert(communityAnnouncements.response.status === 200, `Expected community announcement read-side to return 200, got ${communityAnnouncements.response.status}`);
  assert(
    communityAnnouncements.body?.items.some((item) => item.announcement_id === publishAnnouncement.body.announcement_id),
    'Community read-side did not include the published announcement',
  );

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

  const m3Community = await createSmokeCommunity();
  await joinCommunityByInvite(otpVerify.body.access_token, m3Community.communityId, m3Community.inviteCode);

  const helperOfferOne = await fetchJson<CreatePostResponse>('/v1/posts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${otpVerify.body.access_token}`,
    },
    body: JSON.stringify({
      community_id: m3Community.communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share one grocery bag',
      body: 'Can share one grocery bag tonight.',
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
  assert(helperOfferOne.response.status === 200, `Expected first M3 helper offer to return 200, got ${helperOfferOne.response.status}`);

  const helperJoin = await joinCommunityByInvite(magicLinkVerify.body.access_token, m3Community.communityId, m3Community.inviteCode);
  assert(
    helperJoin.membership_status === 'joined' || helperJoin.membership_status === 'already_joined',
    `Expected M3 helper community join to succeed, got ${helperJoin.membership_status}`,
  );

  const helperOfferTwo = await fetchJson<CreatePostResponse>('/v1/posts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${magicLinkVerify.body.access_token}`,
    },
    body: JSON.stringify({
      community_id: m3Community.communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share pantry staples tomorrow',
      body: 'Can share pantry staples tomorrow morning.',
      language: 'es',
      location_zip: smokeZip,
      privacy: 'community_only',
      expires_at: futureIso(2),
      contact_pref: {
        in_app_chat: true,
        call: false,
        text: false,
      },
    }),
  });
  assert(helperOfferTwo.response.status === 200, `Expected second M3 helper offer to return 200, got ${helperOfferTwo.response.status}`);

  const helperThreeAnonymous = await createAnonymousSession();
  await joinCommunityByInvite(helperThreeAnonymous.body.access_token, m3Community.communityId, m3Community.inviteCode);
  const helperThreeOtpStart = await fetchJson<OtpStartResponse>('/v1/auth/otp/start', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${helperThreeAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      phone: m3HelperThreePhone,
    }),
  });
  assert(helperThreeOtpStart.response.status === 200, `Expected third M3 helper OTP start to return 200, got ${helperThreeOtpStart.response.status}`);
  const helperThreeOtpVerify = await fetchJson<AuthSessionResponse>('/v1/auth/otp/verify', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${helperThreeAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      challenge_id: helperThreeOtpStart.body.challenge_id,
      code: helperThreeOtpStart.body.demo_code,
    }),
  });
  assert(helperThreeOtpVerify.response.status === 200, `Expected third M3 helper OTP verify to return 200, got ${helperThreeOtpVerify.response.status}`);

  const helperOfferThree = await fetchJson<CreatePostResponse>('/v1/posts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${helperThreeOtpVerify.body.access_token}`,
    },
    body: JSON.stringify({
      community_id: m3Community.communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share groceries for tonight pickup',
      body: 'Can share groceries for tonight pickup.',
      language: 'en',
      location_zip: smokeZip,
      privacy: 'community_only',
      expires_at: futureIso(3),
      contact_pref: {
        in_app_chat: true,
        call: false,
        text: false,
      },
    }),
  });
  assert(helperOfferThree.response.status === 200, `Expected third M3 helper offer to return 200, got ${helperOfferThree.response.status}`);

  const m3RequesterAnonymous = await createAnonymousSession();
  await joinCommunityByInvite(m3RequesterAnonymous.body.access_token, m3Community.communityId, m3Community.inviteCode);

  const m3RequestCreate = await fetchJson<CreatePostResponse>('/v1/posts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${m3RequesterAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      community_id: m3Community.communityId,
      post_type: 'request',
      category: 'food',
      title: 'Need groceries after work',
      body: 'Need groceries after work today.',
      language: 'en',
      location_zip: smokeZip,
      privacy: 'community_only',
      expires_at: futureIso(24),
      contact_pref: {
        in_app_chat: true,
        call: false,
        text: false,
      },
    }),
  });
  assert(m3RequestCreate.response.status === 200, `Expected M3 request create to return 200, got ${m3RequestCreate.response.status}`);
  const m3RequestPostId = m3RequestCreate.body.post_id;

  const matchesFirst = await fetchJson<MatchResultsApiResponse>(`/v1/posts/${m3RequestPostId}/matches`, {
    headers: {
      authorization: `Bearer ${m3RequesterAnonymous.body.access_token}`,
    },
  });
  assert(matchesFirst.response.status === 200, `Expected initial matches to return 200, got ${matchesFirst.response.status}`);
  assert(matchesFirst.body?.batch_number === 1, `Expected initial matches batch_number=1, got ${matchesFirst.body?.batch_number ?? '<missing>'}`);
  assert(matchesFirst.body?.items.length === 3, `Expected initial matches to return 3 items, got ${matchesFirst.body?.items.length ?? 0}`);
  const knownHelperTokens = new Map<string, string>([
    [helperOfferOne.body.post_id, otpVerify.body.access_token],
    [helperOfferTwo.body.post_id, magicLinkVerify.body.access_token],
    [helperOfferThree.body.post_id, helperThreeOtpVerify.body.access_token],
  ]);
  const firstNeighborCandidate = matchesFirst.body?.items.find((item) => item.candidate_type === 'neighbor_post');
  assert(firstNeighborCandidate, 'Expected initial matches to include a neighbor suggestion');
  let selectedKnownNeighbor = matchesFirst.body?.items.find(
    (item) => item.candidate_type === 'neighbor_post' && knownHelperTokens.has(item.candidate_id),
  ) ?? null;

  const anonymousContactDenied = await fetchJson<{ message?: string }>('/v1/match/contact', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${m3RequesterAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      from_post_id: m3RequestPostId,
      to_post_id: firstNeighborCandidate.candidate_id,
    }),
  });
  assert(anonymousContactDenied.response.status === 403, `Expected anonymous contact attempt to return 403, got ${anonymousContactDenied.response.status}`);

  const requesterOtpStart = await fetchJson<OtpStartResponse>('/v1/auth/otp/start', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${m3RequesterAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      phone: m3RequesterPhone,
    }),
  });
  assert(requesterOtpStart.response.status === 200, `Expected M3 requester OTP start to return 200, got ${requesterOtpStart.response.status}`);
  assert(Boolean(requesterOtpStart.body?.demo_code), 'Expected M3 requester OTP start to include demo_code');

  const requesterOtpVerify = await fetchJson<AuthSessionResponse>('/v1/auth/otp/verify', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${m3RequesterAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      challenge_id: requesterOtpStart.body.challenge_id,
      code: requesterOtpStart.body.demo_code,
    }),
  });
  assert(requesterOtpVerify.response.status === 200, `Expected M3 requester OTP verify to return 200, got ${requesterOtpVerify.response.status}`);
  assert(requesterOtpVerify.body?.user.level === 'verified', `Expected M3 requester to become verified, got ${requesterOtpVerify.body?.user.level ?? '<missing>'}`);

  assert(selectedKnownNeighbor || matchesFirst.body?.items.length === 3, 'Expected initial matches payload to be present');
  let verifiedContact: { response: Response; body: MatchContactApiResponse | undefined };
  let recipientAccessToken: string | undefined;

  if (selectedKnownNeighbor) {
    recipientAccessToken = knownHelperTokens.get(selectedKnownNeighbor.candidate_id);
    assert(recipientAccessToken, 'Expected selected helper offer to resolve to a recipient access token');

    verifiedContact = await fetchJson<MatchContactApiResponse>('/v1/match/contact', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${requesterOtpVerify.body.access_token}`,
      },
      body: JSON.stringify({
        from_post_id: m3RequestPostId,
        to_post_id: selectedKnownNeighbor.candidate_id,
      }),
    });
    assert(verifiedContact.response.status === 200, `Expected verified contact to return 200, got ${verifiedContact.response.status}`);
    assert(verifiedContact.body?.status === 'pending', `Expected verified contact to create pending request, got ${verifiedContact.body?.status ?? '<missing>'}`);
  } else {
    verifiedContact = { response: new Response(null, { status: 500 }), body: undefined };
  }

  const matchesSecond = await fetchJson<MatchResultsApiResponse>(`/v1/posts/${m3RequestPostId}/matches?refresh=true`, {
    headers: {
      authorization: `Bearer ${requesterOtpVerify.body.access_token}`,
    },
  });
  assert(matchesSecond.response.status === 200, `Expected refreshed matches to return 200, got ${matchesSecond.response.status}`);
  assert(matchesSecond.body?.refreshes_used === 1, `Expected refreshed matches to report 1 refresh, got ${matchesSecond.body?.refreshes_used ?? '<missing>'}`);

  if (!selectedKnownNeighbor) {
    selectedKnownNeighbor =
      matchesSecond.body?.items.find(
        (item) => item.candidate_type === 'neighbor_post' && knownHelperTokens.has(item.candidate_id),
      ) ?? null;
    assert(selectedKnownNeighbor, 'Expected one of the known helper offers to appear in either match batch');
    recipientAccessToken = knownHelperTokens.get(selectedKnownNeighbor.candidate_id);
    assert(recipientAccessToken, 'Expected selected helper offer to resolve to a recipient access token');
    verifiedContact = await fetchJson<MatchContactApiResponse>('/v1/match/contact', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${requesterOtpVerify.body.access_token}`,
      },
      body: JSON.stringify({
        from_post_id: m3RequestPostId,
        to_post_id: selectedKnownNeighbor.candidate_id,
      }),
    });
    assert(verifiedContact.response.status === 200, `Expected verified contact to return 200, got ${verifiedContact.response.status}`);
    assert(verifiedContact.body?.status === 'pending', `Expected verified contact to create pending request, got ${verifiedContact.body?.status ?? '<missing>'}`);
  } else {
    const replayedContact = await fetchJson<MatchContactApiResponse>('/v1/match/contact', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${requesterOtpVerify.body.access_token}`,
      },
      body: JSON.stringify({
        from_post_id: m3RequestPostId,
        to_post_id: selectedKnownNeighbor.candidate_id,
      }),
    });
    assert(replayedContact.response.status === 200, `Expected replayed contact to return 200, got ${replayedContact.response.status}`);
    assert(
      replayedContact.body?.contact_request_id === verifiedContact.body?.contact_request_id,
      'Expected replayed contact to reuse the existing contact_request_id',
    );
  }

  const recipientInbox = await fetchJson<ContactRequestsInboxApiResponse>('/v1/contact-requests/inbox', {
    headers: {
      authorization: `Bearer ${recipientAccessToken}`,
    },
  });
  assert(recipientInbox.response.status === 200, `Expected recipient inbox to return 200, got ${recipientInbox.response.status}`);
  assert(
    recipientInbox.body?.items.some((item) => item.contact_request_id === verifiedContact.body.contact_request_id),
    'Recipient inbox did not include the pending contact request',
  );

  const recipientAccept = await fetchJson<ContactRequestDecisionApiResponse>(
    `/v1/contact-requests/${verifiedContact.body.contact_request_id}/accept`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${recipientAccessToken}`,
      },
    },
  );
  assert(recipientAccept.response.status === 200, `Expected recipient accept to return 200, got ${recipientAccept.response.status}`);
  assert(Boolean(recipientAccept.body?.conversation_id), 'Expected accept to create a conversation_id');

  const requesterConversations = await fetchJson<ConversationsListApiResponse>(
    '/v1/conversations',
    {
      headers: {
        authorization: `Bearer ${requesterOtpVerify.body.access_token}`,
      },
    },
  );
  assert(requesterConversations.response.status === 200, `Expected requester conversations to return 200, got ${requesterConversations.response.status}`);
  assert(
    requesterConversations.body?.items.some((conversation) => conversation.conversation_id === recipientAccept.body.conversation_id),
    'Requester conversations did not include the accepted conversation',
  );

  const recipientSocket = await openChatSocket(recipientAccessToken!);

  const conversationDetail = await fetchJson<ConversationDetailApiResponse>(
    `/v1/conversations/${recipientAccept.body.conversation_id}`,
    {
      headers: {
        authorization: `Bearer ${requesterOtpVerify.body.access_token}`,
      },
    },
  );
  assert(conversationDetail.response.status === 200, `Expected conversation detail to return 200, got ${conversationDetail.response.status}`);
  assert(
    conversationDetail.body?.status === 'active',
    `Expected conversation detail status active, got ${conversationDetail.body?.status ?? '<missing>'}`,
  );

  const realtimeMessageEventPromise = waitForRealtimeEvent(
    recipientSocket,
    (event): event is Extract<ChatRealtimeSmokeEvent, { event_type: 'message.created' }> =>
      event.event_type === 'message.created' && event.conversation_id === recipientAccept.body.conversation_id,
  );
  const realtimeConversationEventPromise = waitForRealtimeEvent(
    recipientSocket,
    (event): event is Extract<ChatRealtimeSmokeEvent, { event_type: 'conversation.updated' }> =>
      event.event_type === 'conversation.updated' &&
      event.conversation.conversation_id === recipientAccept.body.conversation_id,
  );

  const sendMessage = await fetchJson<SendConversationMessageApiResponse>(
    `/v1/conversations/${recipientAccept.body.conversation_id}/messages`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${requesterOtpVerify.body.access_token}`,
      },
      body: JSON.stringify({
        body: 'I can meet at the library at 3pm.',
      }),
    },
  );
  assert(sendMessage.response.status === 200, `Expected send message to return 200, got ${sendMessage.response.status}`);
  assert(sendMessage.body?.message.is_mine === true, 'Expected send message to mark the sender message as mine');
  const realtimeMessageEvent = await realtimeMessageEventPromise;
  assert(
    realtimeMessageEvent.message.body === 'I can meet at the library at 3pm.',
    'Expected websocket message.created payload to include the sent body',
  );
  assert(realtimeMessageEvent.message.is_mine === false, 'Expected recipient websocket payload to mark incoming message as not mine');
  const realtimeConversationEvent = await realtimeConversationEventPromise;
  assert(
    realtimeConversationEvent.conversation.unread_count >= 1,
    `Expected recipient websocket payload to carry unread_count >= 1, got ${realtimeConversationEvent.conversation.unread_count}`,
  );

  const conversationMessages = await fetchJson<ConversationMessagesApiResponse>(
    `/v1/conversations/${recipientAccept.body.conversation_id}/messages`,
    {
      headers: {
        authorization: `Bearer ${recipientAccessToken}`,
      },
    },
  );
  assert(conversationMessages.response.status === 200, `Expected list messages to return 200, got ${conversationMessages.response.status}`);
  assert(
    conversationMessages.body?.items.some((message) => message.body === 'I can meet at the library at 3pm.'),
    'Expected conversation messages to include the sent message',
  );

  const reportMessage = await fetchJson<ReportCreateApiResponse>('/v1/reports', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${recipientAccessToken}`,
    },
    body: JSON.stringify({
      target_type: 'message',
      target_id: conversationMessages.body?.items[0]?.message_id,
      reason: 'unsafe_behavior',
      conversation_id: recipientAccept.body.conversation_id,
      evidence_description: 'Unsafe meetup request',
    }),
  });
  assert(reportMessage.response.status === 200, `Expected report create to return 200, got ${reportMessage.response.status}`);

  const blockUser = await fetchJson<BlockUserApiResponse>('/v1/blocks', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${recipientAccessToken}`,
    },
    body: JSON.stringify({
      blocked_user_id: requesterOtpVerify.body.user.user_id,
      conversation_id: recipientAccept.body.conversation_id,
    }),
  });
  assert(blockUser.response.status === 200, `Expected block user to return 200, got ${blockUser.response.status}`);
  assert(
    blockUser.body?.affected_conversation_ids.includes(recipientAccept.body.conversation_id!),
    'Expected blocked response to include the current conversation_id',
  );

  const blockedConversation = await fetchJson<{ message?: string }>(
    `/v1/conversations/${recipientAccept.body.conversation_id}`,
    {
      headers: {
        authorization: `Bearer ${recipientAccessToken}`,
      },
    },
  );
  assert(blockedConversation.response.status === 409, `Expected blocked conversation read to return 409, got ${blockedConversation.response.status}`);
  recipientSocket.close();

  const closeConversation = await fetchJson<CloseConversationApiResponse>(
    `/v1/conversations/${recipientAccept.body.conversation_id}/close`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${requesterOtpVerify.body.access_token}`,
      },
    },
  );
  assert(closeConversation.response.status === 409, `Expected closing a blocked conversation to return 409, got ${closeConversation.response.status}`);

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

  // ---------------------------------------------------------------------
  // M8 account lifecycle coverage: /v1/account/delete/{request,confirm},
  // /v1/account/undelete/{request,}, /v1/auth/anchor/session/recovery.
  // Uses dedicated users so that mid-run side effects (session revocation,
  // soft-delete, anchor role downgrade) do not leak into earlier assertions.
  // ---------------------------------------------------------------------

  // Step 1 — fresh user for the delete+undelete happy path.
  const deleteTargetAnonymous = await createAnonymousSession();
  const deleteTargetPhone = `+1520${runId.slice(-7)}`;
  const deleteTargetOtpStart = await fetchJson<OtpStartResponse>('/v1/auth/otp/start', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${deleteTargetAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      phone: deleteTargetPhone,
    }),
  });
  assert(
    deleteTargetOtpStart.response.status === 200,
    `Expected delete-target OTP start to return 200, got ${deleteTargetOtpStart.response.status}`,
  );
  assert(
    Boolean(deleteTargetOtpStart.body?.demo_code),
    'Expected delete-target OTP start to include demo_code',
  );

  const deleteTargetVerified = await fetchJson<AuthSessionResponse>('/v1/auth/otp/verify', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${deleteTargetAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      challenge_id: deleteTargetOtpStart.body.challenge_id,
      code: deleteTargetOtpStart.body.demo_code,
    }),
  });
  assert(
    deleteTargetVerified.response.status === 200,
    `Expected delete-target OTP verify to return 200, got ${deleteTargetVerified.response.status}`,
  );
  assert(
    deleteTargetVerified.body?.user.level === 'verified',
    `Expected delete-target OTP verify to return verified, got ${deleteTargetVerified.body?.user.level ?? '<missing>'}`,
  );
  const deleteTargetAccessToken = deleteTargetVerified.body.access_token;
  const deleteTargetUserId = deleteTargetVerified.body.user.user_id;

  // Step 2 — happy path: issue the deletion challenge.
  const deleteRequest = await fetchJson<AccountDeleteRequestResponse>(
    '/v1/account/delete/request',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${deleteTargetAccessToken}`,
      },
      body: JSON.stringify({}),
    },
  );
  assert(
    deleteRequest.response.status === 200,
    `Expected POST /v1/account/delete/request to return 200, got ${deleteRequest.response.status}`,
  );
  assert(
    Boolean(deleteRequest.body?.challenge_id),
    'Expected /v1/account/delete/request to return a challenge_id',
  );
  assert(
    deleteRequest.body?.delivery_channel === 'sms' || deleteRequest.body?.delivery_channel === 'email',
    `Expected delete/request delivery_channel sms|email, got ${deleteRequest.body?.delivery_channel ?? '<missing>'}`,
  );
  assert(
    Boolean(deleteRequest.body?.demo_code) || Boolean(deleteRequest.body?.demo_token),
    'Expected delete/request to expose a demo_code or demo_token for smoke',
  );

  // Step 3 — confirm with the wrong code returns 400 with a descriptive error.
  const deleteConfirmBad = await fetchJson<{ message?: string }>(
    '/v1/account/delete/confirm',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${deleteTargetAccessToken}`,
      },
      body: JSON.stringify({
        challenge_id: deleteRequest.body.challenge_id,
        code: '000000',
        reason: 'no_longer_needed',
      }),
    },
  );
  assert(
    deleteConfirmBad.response.status === 400,
    `Expected delete/confirm with wrong code to return 400, got ${deleteConfirmBad.response.status}`,
  );

  // Step 4 — confirm with the correct demo code schedules the soft-delete.
  const deleteConfirm = await fetchJson<AccountDeleteConfirmResponse>(
    '/v1/account/delete/confirm',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${deleteTargetAccessToken}`,
      },
      body: JSON.stringify({
        challenge_id: deleteRequest.body.challenge_id,
        code: deleteRequest.body.demo_code ?? deleteRequest.body.demo_token,
        reason: 'no_longer_needed',
      }),
    },
  );
  assert(
    deleteConfirm.response.status === 202,
    `Expected delete/confirm to return 202, got ${deleteConfirm.response.status}`,
  );
  assert(
    deleteConfirm.body?.status === 'deletion_scheduled',
    `Expected delete/confirm status deletion_scheduled, got ${deleteConfirm.body?.status ?? '<missing>'}`,
  );
  assert(
    deleteConfirm.body?.user_id === deleteTargetUserId,
    'Expected delete/confirm to echo the deleted user_id',
  );
  assert(
    Boolean(deleteConfirm.body?.undelete_recovery_token),
    'Expected delete/confirm to return undelete_recovery_token',
  );

  // Step 5 — undelete with a bad token returns 404 with an opaque
  // "recovery_not_available" message. Per A1 P1-11 (F1-α), every non-
  // success branch — missing user, wrong state, past purge, bad token —
  // now collapses to the same 404 to neutralize user-existence +
  // account-state enumeration. The actual distinction is server-side
  // logged only.
  const undeleteBad = await fetchJson<{ message?: string }>('/v1/account/undelete', {
    method: 'POST',
    body: JSON.stringify({
      user_id: deleteTargetUserId,
      recovery_token: `uri_${deleteTargetUserId.slice(0, 8)}_invalid_token_${runId}`,
    }),
  });
  assert(
    undeleteBad.response.status === 404,
    `Expected undelete with bad token to return 404, got ${undeleteBad.response.status}`,
  );

  // Step 6 — undelete with the real recovery token restores the account.
  const undelete = await fetchJson<AccountUndeleteResponse>('/v1/account/undelete', {
    method: 'POST',
    body: JSON.stringify({
      user_id: deleteTargetUserId,
      recovery_token: deleteConfirm.body.undelete_recovery_token,
    }),
  });
  assert(
    undelete.response.status === 200,
    `Expected undelete to return 200, got ${undelete.response.status}`,
  );
  assert(
    undelete.body?.status === 'restored',
    `Expected undelete status restored, got ${undelete.body?.status ?? '<missing>'}`,
  );
  assert(
    undelete.body?.user_id === deleteTargetUserId,
    'Expected undelete to echo the restored user_id',
  );

  // Step 7 — rate limit coverage for delete/request. Uses a second dedicated
  // user so the 3/h bucket for the previous user is untouched. We fire enough
  // requests to cross accountDeleteBurstLimit (3) and expect the fourth to 429.
  const rateTargetAnonymous = await createAnonymousSession();
  const rateTargetPhone = `+1521${runId.slice(-7)}`;
  const rateTargetOtpStart = await fetchJson<OtpStartResponse>('/v1/auth/otp/start', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${rateTargetAnonymous.body.access_token}`,
    },
    body: JSON.stringify({ phone: rateTargetPhone }),
  });
  assert(
    rateTargetOtpStart.response.status === 200,
    `Expected rate-target OTP start to return 200, got ${rateTargetOtpStart.response.status}`,
  );
  const rateTargetVerified = await fetchJson<AuthSessionResponse>('/v1/auth/otp/verify', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${rateTargetAnonymous.body.access_token}`,
    },
    body: JSON.stringify({
      challenge_id: rateTargetOtpStart.body.challenge_id,
      code: rateTargetOtpStart.body.demo_code,
    }),
  });
  assert(
    rateTargetVerified.response.status === 200,
    `Expected rate-target OTP verify to return 200, got ${rateTargetVerified.response.status}`,
  );
  const rateTargetAccessToken = rateTargetVerified.body.access_token;

  let deleteRateLimitHit = false;
  let deleteRateLimitStatus = 0;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const probe = await fetchJson<{ message?: string }>(
      '/v1/account/delete/request',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${rateTargetAccessToken}`,
        },
        body: JSON.stringify({}),
      },
    );
    if (probe.response.status === 429) {
      deleteRateLimitHit = true;
      deleteRateLimitStatus = 429;
      break;
    }
    assert(
      probe.response.status === 200,
      `Expected delete/request attempt ${attempt} to return 200 before the rate limit fires, got ${probe.response.status}`,
    );
  }
  assert(
    deleteRateLimitHit,
    `Expected /v1/account/delete/request to eventually return 429; last status ${deleteRateLimitStatus}`,
  );

  // Step 8 — anchor session recovery coverage. The m5 anchor already holds
  // two recovery codes from anchorActivation; reuse them here.
  const anchorRecoveryCodes = anchorActivation.body.recovery_codes;
  assert(
    Array.isArray(anchorRecoveryCodes) && anchorRecoveryCodes.length >= 2,
    'Expected anchor activation to return at least two recovery codes for smoke',
  );

  // Invalid code path (400).
  const anchorRecoveryBad = await fetchJson<AnchorSessionRecoveryErrorResponse>(
    '/v1/auth/anchor/session/recovery',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${m5AnchorVerified.body.access_token}`,
      },
      body: JSON.stringify({
        community_id: seedIds.communityId,
        recovery_code: 'ZZZZ-ZZZZ',
      }),
    },
  );
  assert(
    anchorRecoveryBad.response.status === 400,
    `Expected anchor/session/recovery with bad code to return 400, got ${anchorRecoveryBad.response.status}`,
  );

  // Happy path (200) — consume a real recovery code.
  const anchorRecoveryOk = await fetchJson<AuthSessionResponse>(
    '/v1/auth/anchor/session/recovery',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${m5AnchorVerified.body.access_token}`,
      },
      body: JSON.stringify({
        community_id: seedIds.communityId,
        recovery_code: anchorRecoveryCodes[0],
      }),
    },
  );
  assert(
    anchorRecoveryOk.response.status === 200,
    `Expected anchor/session/recovery happy path to return 200, got ${anchorRecoveryOk.response.status}`,
  );
  assert(
    anchorRecoveryOk.body?.user.level === 'anchor',
    `Expected anchor/session/recovery to return anchor level, got ${anchorRecoveryOk.body?.user.level ?? '<missing>'}`,
  );

  // Rate limit path (429) — after happy path plus the earlier invalid attempt,
  // fire up to recoveryCodeBurstLimit+2 more to saturate the 5/h bucket.
  const anchorRecoveryToken = anchorRecoveryOk.body.access_token;
  let anchorRecoveryRateLimitHit = false;
  let anchorRecoveryLastStatus = 0;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const probe = await fetchJson<AnchorSessionRecoveryErrorResponse>(
      '/v1/auth/anchor/session/recovery',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${anchorRecoveryToken}`,
        },
        body: JSON.stringify({
          community_id: seedIds.communityId,
          recovery_code: 'ZZZZ-ZZZZ',
        }),
      },
    );
    anchorRecoveryLastStatus = probe.response.status;
    if (probe.response.status === 429) {
      anchorRecoveryRateLimitHit = true;
      break;
    }
    assert(
      probe.response.status === 400,
      `Expected anchor/session/recovery saturation attempt ${attempt} to return 400 before 429, got ${probe.response.status}`,
    );
  }
  assert(
    anchorRecoveryRateLimitHit,
    `Expected anchor/session/recovery to eventually return 429; last status ${anchorRecoveryLastStatus}`,
  );

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
          'POST /v1/auth/anchor/activate',
          'POST /v1/auth/anchor/activate/confirm',
          'POST /v1/auth/anchor/session/start',
          'POST /v1/auth/anchor/session/verify',
          'POST /v1/posts (M3 requester request)',
          'GET /v1/posts/:post_id/matches',
          'GET /v1/posts/:post_id/matches?refresh=true',
          'POST /v1/match/contact (anonymous -> 403)',
          'POST /v1/auth/otp/start (M3 requester)',
          'POST /v1/auth/otp/verify (M3 requester)',
          'POST /v1/match/contact (verified)',
          'GET /v1/contact-requests/inbox',
          'POST /v1/contact-requests/:contact_request_id/accept',
          'GET /v1/conversations',
          'GET /v1/conversations/:conversation_id',
          'POST /v1/conversations/:conversation_id/messages',
          'GET /v1/conversations/:conversation_id/messages',
          'GET /v1/ws/chat?token=...',
          'GET /v1/admin/report_queue',
          'POST /v1/admin/report_queue/:report_id/decision',
          'PUT /v1/admin/communities/:community_id/rules',
          'POST /v1/admin/communities/:community_id/announcements',
          'GET /v1/communities/:community_id/announcements',
          'POST /v1/reports',
          'POST /v1/blocks',
          'POST /v1/conversations/:conversation_id/close (blocked -> 409)',
          'GET /v1/resources',
          'GET /v1/resources/:provider_id',
          'POST /v1/account/delete/request (200 happy)',
          'POST /v1/account/delete/confirm (400 bad code)',
          'POST /v1/account/delete/confirm (202 scheduled)',
          'POST /v1/account/undelete (404 recovery_not_available)',
          'POST /v1/account/undelete (200 restored)',
          'POST /v1/account/delete/request (429 rate limit)',
          'POST /v1/auth/anchor/session/recovery (400 invalid code)',
          'POST /v1/auth/anchor/session/recovery (200 happy)',
          'POST /v1/auth/anchor/session/recovery (429 rate limit)',
          'GET /docs',
        ],
        requestPostId,
        m3RequestPostId,
        m3ContactRequestId: verifiedContact.body.contact_request_id,
        m3ConversationId: recipientAccept.body.conversation_id,
        m4ReportedMessageId: conversationMessages.body?.items[0]?.message_id ?? null,
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

async function createSmokeCommunity() {
  const config = await loadConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
  });
  const communityId = randomUUID();
  const inviteCode = `M3-${runId}`;

  try {
    await pool.query(
      `
        insert into communities (
          community_id,
          name,
          center_zip,
          join_policy,
          created_at,
          updated_at
        )
        values ($1, $2, $3, 'invite_only', now(), now())
      `,
      [communityId, `M3 Smoke ${runId}`, smokeZip],
    );
    await pool.query(
      `
        insert into community_access_codes (
          access_code_id,
          community_id,
          channel,
          code,
          status,
          created_at
        )
        values ($1, $2, 'invite_code', $3, 'active', now())
      `,
      [randomUUID(), communityId, inviteCode],
    );
  } finally {
    await pool.end();
  }

  return {
    communityId,
    inviteCode,
  };
}

async function createSmokeAnchorInvite() {
  const config = await loadConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
  });
  const inviteCode = `M5-ANCHOR-${runId}`;

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
        seedIds.communityId,
        hashInviteCode(inviteCode),
        'St. Kilian Parish Social Ministry',
      ],
    );
  } finally {
    await pool.end();
  }

  return {
    inviteCode,
  };
}

async function joinCommunityByInvite(accessToken: string, communityId: string, inviteCode: string) {
  const resolveInvite = await fetchJson<CommunityResolveResponse>('/v1/community-access/resolve', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      invite_code: inviteCode,
    }),
  });
  assert(resolveInvite.response.status === 200, `Expected invite resolve to return 200, got ${resolveInvite.response.status}`);

  const joinInvite = await fetchJson<JoinCommunityResponse>(`/v1/communities/${communityId}/join`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      join_token: resolveInvite.body.join_token,
    }),
  });
  assert(joinInvite.response.status === 200, `Expected join to return 200, got ${joinInvite.response.status}`);
  return joinInvite.body;
}

function hashInviteCode(inviteCode: string) {
  return createHash('sha256').update(inviteCode.trim().toUpperCase()).digest('hex');
}

function readTotpSecret(otpauthUri: string) {
  const url = new URL(otpauthUri);
  const secret = url.searchParams.get('secret');
  assert(Boolean(secret), 'TOTP secret missing from otpauth URI');
  return secret!;
}

function generateTotpCode(secret: string, now = Date.now()) {
  const decoded = decodeBase32(secret);
  const counter = Math.floor(now / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decoded).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = base32Alphabet.indexOf(char);
    assert(index >= 0, 'Invalid base32 secret');
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

async function resetAuthAbuseState() {
  const config = await loadConfig();
  await clearRedisAuthAbuseKeys(config.redisUrl);
}

async function openChatSocket(accessToken: string) {
  const socketUrl = apiBaseUrl.replace(/^http/i, 'ws') + `/v1/ws/chat?token=${encodeURIComponent(accessToken)}`;
  // F4-A Fix #3 (PR #62) added a WS Origin allow-list. The `ws` client
  // library does NOT set an Origin header by default, so the server
  // rejected every smoke connection with code 1008 ("Invalid origin")
  // right after `open` — the client saw open, then the immediate close,
  // and then `waitForRealtimeEvent` timed out looking for the heartbeat
  // that never came. That's the actual source of the permanent CI red
  // on validate→Real API smoke for the past 3 days.
  //
  // Pass an Origin that matches the dev-mode allow-list
  // (`http://localhost:*` / `http://127.0.0.1:*`) and the staging/prod
  // list (weavenyc.org). The Node `ws` library accepts `origin` as a
  // constructor option and stamps it onto the handshake's
  // Sec-WebSocket-Origin header.
  const wsOrigin = process.env.WEAVENYC_SMOKE_WS_ORIGIN ?? 'http://127.0.0.1:4000';
  const socket = new WebSocket(socketUrl, { origin: wsOrigin });

  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', () => reject(new Error(`Failed to open websocket ${socketUrl}`)));
  });

  await waitForRealtimeEvent(
    socket,
    (event): event is Extract<ChatRealtimeSmokeEvent, { event_type: 'heartbeat' }> =>
      event.event_type === 'heartbeat',
  );

  return socket;
}

async function waitForRealtimeEvent<T extends ChatRealtimeSmokeEvent>(
  socket: RuntimeWebSocket,
  predicate: (event: ChatRealtimeSmokeEvent) => event is T,
  // Default bumped from 5s → 15s (override via REAL_API_REALTIME_TIMEOUT_MS)
  // because 5s is too tight for the CI validate job — GH Actions runners
  // cold-start Postgres / Redis / API gateway inside the same job, and the
  // very first websocket subscription can take 5-8s before the broker
  // publishes the first event. Local dev typically sees <200ms round-trip
  // so this ceiling only bites on first-boot CI. If a regression makes
  // realtime genuinely slow, adjust the env var rather than edit again.
  timeoutMs = Number(process.env.REAL_API_REALTIME_TIMEOUT_MS ?? 15_000),
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('message', handleMessage);
      socket.off('error', handleError);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for realtime event`));
    }, timeoutMs);

    const handleMessage = (data: RawData) => {
      let payload: ChatRealtimeSmokeEvent;
      try {
        payload = JSON.parse(rawDataToString(data)) as ChatRealtimeSmokeEvent;
      } catch {
        return;
      }

      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timeout);
      socket.off('message', handleMessage);
      socket.off('error', handleError);
      resolve(payload);
    };

    const handleError = () => {
      clearTimeout(timeout);
      socket.off('message', handleMessage);
      socket.off('error', handleError);
      reject(new Error('Realtime socket errored before receiving the expected event'));
    };

    socket.on('message', handleMessage);
    socket.once('error', handleError);
  });
}

function rawDataToString(data: RawData) {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof Buffer) {
    return data.toString();
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString();
  }

  return Buffer.from(data).toString();
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
