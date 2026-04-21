import {
  accountDeleteConfirmRequestSchema,
  accountDeleteConfirmResponseSchema,
  accountDeleteRequestRequestSchema,
  accountDeleteRequestResponseSchema,
  accountDeleteResponseSchema,
  accountUndeleteConfirmResponseSchema,
  anonymousAuthResponseSchema,
  blockUserResponseSchema,
  closeConversationResponseSchema,
  conversationDetailSchema,
  conversationMessagesResponseSchema,
  conversationsListResponseSchema,
  contactRequestDecisionResponseSchema,
  contactRequestInboxResponseSchema,
  communityAccessResolveResponseSchema,
  reportCreateResponseSchema,
  sendConversationMessageRequestSchema,
  sendConversationMessageResponseSchema,
  matchContactRequestSchema,
  matchContactResponseSchema,
  matchResultsResponseSchema,
  createPostResponseSchema,
  healthcheckResponseSchema,
  joinCommunityResponseSchema,
  magicLinkStartResponseSchema,
  magicLinkVerifyResponseSchema,
  myPostsResponseSchema,
  otpStartResponseSchema,
  otpVerifyResponseSchema,
  postDetailSchema,
  postsListResponseSchema,
  refreshSessionResponseSchema,
  resourceDetailSchema,
  resourceListResponseSchema,
  speechTranscribeResponseSchema,
  updatePostRequestSchema,
} from "@weavenyc/shared";
import type {
  AccountDeleteConfirmResponse,
  AccountDeleteReason,
  AccountDeleteRequestResponse,
  AccountUndeleteConfirmResponse,
} from "@weavenyc/shared";

import type {
  AccountDeleteInput,
  AccountDeleteResult,
  AnonymousSessionResponse,
  BlockUserInput,
  BlockUserResult,
  CloseConversationResult,
  ConversationDetail,
  ConversationMessagesInput,
  ConversationMessagesResponse,
  ConversationsListInput,
  ConversationsListResponse,
  ContactRequestDecisionResult,
  ContactRequestInboxInput,
  ContactRequestInboxResponse,
  CommunityAccessResolveInput,
  CommunityAccessResolveResult,
  CommunityAnnouncement,
  CommunityAnnouncementsResponse,
  CommunityBootstrapResponse,
  CommunitySnapshot,
  CommunitySyncDeltaResponse,
  CommunitySyncEvent,
  CommunitySyncEventType,
  CommunitySyncAggregateType,
  CreatePostInput,
  CreatePostResult,
  EndpointProbe,
  JoinCommunityResult,
  MatchContactInput,
  MatchContactResult,
  MatchResultsResponse,
  MagicLinkStartInput,
  MagicLinkStartResult,
  MagicLinkVerifyInput,
  MyPostsInput,
  OtpStartInput,
  OtpStartResult,
  OtpVerifyInput,
  PostDetail,
  PostListInput,
  PostsResponse,
  ReportCreateInput,
  ReportCreateResult,
  ResourceDetail,
  ResourceQueryInput,
  ResourcesResponse,
  SendConversationMessageInput,
  SendConversationMessageResult,
  SpeechTranscribeInput,
  SpeechTranscribeResult,
  UpdatePostInput,
} from "@/lib/types";

const DEFAULT_API_BASE_URL = "http://localhost:4000";
const DEVICE_ID_STORAGE_KEY = "weavenyc.device_id";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, ...keys: string[]) {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    if (typeof value[key] === 'string') {
      return value[key] as string;
    }
  }

  return null;
}

function readNumber(value: unknown, ...keys: string[]) {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
      return value[key] as number;
    }
  }

  return null;
}

function toCommunitySnapshot(value: unknown): CommunitySnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const snapshot: CommunitySnapshot = {
    last_event_at: readString(value, 'last_event_at', 'lastEventAt'),
  };

  // `event_count` is optional on the /sync hot path now — only attach
  // when present. See P4 finding 3 / B.
  if (typeof value.event_count === 'number') {
    snapshot.event_count = value.event_count;
  } else if (typeof value.eventCount === 'number') {
    snapshot.event_count = value.eventCount;
  }

  return snapshot;
}

function getDefaultTopics(communityId: string) {
  return {
    posts: `weavenyc/${communityId}/posts`,
    announcements: `weavenyc/${communityId}/announcements`,
    reports: `weavenyc/${communityId}/reports`,
  };
}

function toBootstrapNode(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const nodeId = readString(value, 'node_id', 'nodeId', 'peer_id', 'peerId', 'id');
  const websocketUrl = readString(value, 'websocket_url', 'websocketUrl', 'url', 'ws_url', 'wsUrl', 'multiaddr');

  if (!nodeId || !websocketUrl) {
    return null;
  }

  return {
    node_id: nodeId,
    websocket_url: websocketUrl,
    last_published_at: readString(value, 'last_published_at', 'lastPublishedAt'),
  };
}

function parseCommunityBootstrapResponse(input: unknown, expectedCommunityId: string): CommunityBootstrapResponse {
  if (!isRecord(input)) {
    throw new Error('Invalid community bootstrap response.');
  }

  const communityId = readString(input, 'community_id', 'communityId') ?? expectedCommunityId;
  const relayNodesRaw = Array.isArray(input.relay_nodes)
    ? input.relay_nodes
    : Array.isArray(input.relayNodes)
      ? input.relayNodes
      : [];
  const relayNodes = relayNodesRaw
    .map((item) => toBootstrapNode(item))
    .filter((item): item is NonNullable<ReturnType<typeof toBootstrapNode>> => Boolean(item));
  const topics = isRecord(input.topics)
    ? {
        posts: readString(input.topics, 'posts') ?? getDefaultTopics(communityId).posts,
        announcements:
          readString(input.topics, 'announcements') ?? getDefaultTopics(communityId).announcements,
        reports: readString(input.topics, 'reports') ?? getDefaultTopics(communityId).reports,
      }
    : getDefaultTopics(communityId);

  return {
    community_id: communityId,
    // Default to the current overlay tag if the server didn't send one so
    // legacy (pre-protocol-version) fixtures in tests keep parsing. The
    // worker-side check is authoritative — a real live server that omits
    // the tag will mismatch the constant at the guard.
    protocol_version: 'm6-overlay-v1',
    bootstrap_version: readString(input, 'bootstrap_version', 'bootstrapVersion') ?? 'v1',
    anchor_node: toBootstrapNode(input.anchor_node ?? input.anchorNode),
    relay_nodes: relayNodes,
    topics,
    latest_snapshot: toCommunitySnapshot(input.latest_snapshot ?? input.latestSnapshot) ?? {
      last_event_at: null,
    },
    mdns_demo_enabled:
      typeof input.mdns_demo_enabled === 'boolean'
        ? input.mdns_demo_enabled
        : typeof input.mdnsDemoEnabled === 'boolean'
          ? input.mdnsDemoEnabled
          : false,
  };
}

function isCommunitySyncEventType(value: string): value is CommunitySyncEventType {
  return [
    'post.published',
    'post.updated',
    'post.tombstoned',
    'announcement.published',
    'announcement.updated',
    'announcement.deleted',
    'report.created',
    'moderation.decision',
  ].includes(value);
}

function isCommunitySyncAggregateType(value: string): value is CommunitySyncAggregateType {
  return ['post', 'announcement', 'report', 'moderation'].includes(value);
}

function toCommunitySyncEvent(value: unknown, communityId: string): CommunitySyncEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const eventType = readString(value, 'event_type', 'eventType');
  const aggregateType = readString(value, 'aggregate_type', 'aggregateType');
  const syncEventId = readString(value, 'sync_event_id', 'syncEventId', 'event_id', 'eventId');
  const aggregateId = readString(value, 'aggregate_id', 'aggregateId');
  const occurredAt = readString(value, 'occurred_at', 'occurredAt');

  if (
    !eventType ||
    !aggregateType ||
    !syncEventId ||
    !aggregateId ||
    !occurredAt ||
    !isCommunitySyncEventType(eventType) ||
    !isCommunitySyncAggregateType(aggregateType)
  ) {
    return null;
  }

  // Loose runtime parser — the true shape is enforced by the worker's Zod
  // safeParse against `communitySyncEventSchema`. We cast through `unknown`
  // to the discriminated union because the per-event payload type cannot
  // be narrowed until the worker's safeParse runs.
  return {
    sync_event_id: syncEventId,
    community_id: readString(value, 'community_id', 'communityId') ?? communityId,
    // `topic` is required on the server-side schema but the PWA's cache /
    // parser has historically ignored it. Fill with empty-string so the
    // type check passes; the worker's safeParse rejects any event that
    // really arrives without one.
    topic: readString(value, 'topic') ?? '',
    event_type: eventType,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    actor_p2p_id: readString(value, 'actor_p2p_id', 'actorP2pId'),
    payload: (isRecord(value.payload)
      ? value.payload
      : isRecord(value.payload_json)
        ? value.payload_json
        : isRecord(value.payloadJson)
          ? value.payloadJson
          : {}) as CommunitySyncEvent['payload'],
    cid: readString(value, 'cid'),
    occurred_at: occurredAt,
  } as CommunitySyncEvent;
}

function parseCommunitySyncDeltaResponse(input: unknown, communityId: string): CommunitySyncDeltaResponse {
  if (!isRecord(input)) {
    throw new Error('Invalid community sync response.');
  }

  const rawEvents = Array.isArray(input.events) ? input.events : [];
  const events = rawEvents
    .map((item) => toCommunitySyncEvent(item, communityId))
    .filter((item): item is CommunitySyncEvent => Boolean(item));
  const serverTime = readString(input, 'server_time', 'serverTime') ?? new Date().toISOString();

  return {
    // Default to the current overlay tag when parsing loose response
    // fixtures in tests / migration smoke. The authoritative check runs
    // in the worker against `safeParse`d payloads.
    protocol_version: 'm6-overlay-v1',
    events,
    next_since: readString(input, 'next_since', 'nextSince'),
    server_time: serverTime,
    latest_snapshot: toCommunitySnapshot(input.latest_snapshot ?? input.latestSnapshot) ?? {
      last_event_at: null,
    },
    // The server emits `events.length === limit` here. When missing
    // (legacy server / cache fallback) default to `false` so the client
    // doesn't loop forever.
    has_more:
      typeof input.has_more === 'boolean'
        ? input.has_more
        : typeof input.hasMore === 'boolean'
          ? input.hasMore
          : false,
  };
}

function toCommunityAnnouncement(value: unknown): CommunityAnnouncement | null {
  if (!isRecord(value)) {
    return null;
  }

  const announcementId =
    typeof value.announcement_id === "string"
      ? value.announcement_id
      : typeof value.announcementId === "string"
        ? value.announcementId
        : null;
  const communityId =
    typeof value.community_id === "string"
      ? value.community_id
      : typeof value.communityId === "string"
        ? value.communityId
        : null;
  const title = typeof value.title === "string" ? value.title : null;
  const body = typeof value.body === "string" ? value.body : null;

  if (!announcementId || !communityId || !title || !body) {
    return null;
  }

  return {
    announcement_id: announcementId,
    community_id: communityId,
    title,
    body,
    p2p_version: readNumber(value, 'p2p_version', 'p2pVersion'),
    is_pinned:
      typeof value.is_pinned === "boolean"
        ? value.is_pinned
        : typeof value.pinned === "boolean"
          ? value.pinned
          : false,
    status: typeof value.status === "string" ? value.status : null,
    published_at:
      typeof value.published_at === "string"
        ? value.published_at
        : typeof value.publishedAt === "string"
          ? value.publishedAt
          : null,
    updated_at:
      typeof value.updated_at === "string"
        ? value.updated_at
        : typeof value.updatedAt === "string"
          ? value.updatedAt
          : null,
    created_at:
      typeof value.created_at === "string"
        ? value.created_at
        : typeof value.createdAt === "string"
          ? value.createdAt
          : null,
  };
}

function parseCommunityAnnouncementsResponse(input: unknown): CommunityAnnouncementsResponse {
  const rawItems = Array.isArray(input)
    ? input
    : isRecord(input)
      ? Array.isArray(input.items)
        ? input.items
        : Array.isArray(input.announcements)
          ? input.announcements
          : null
      : null;

  if (!rawItems) {
    throw new Error("Invalid community announcements response.");
  }

  const items = rawItems
    .map((item) => toCommunityAnnouncement(item))
    .filter((item): item is CommunityAnnouncement => Boolean(item));

  const nextCursor = isRecord(input) && typeof input.next_cursor === "string" ? input.next_cursor : null;

  return {
    items,
    next_cursor: nextCursor,
  };
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export function getChatWebSocketUrl(accessToken: string) {
  const baseUrl = getApiBaseUrl();
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws/chat';
  url.search = '';
  url.searchParams.set('token', accessToken);
  return url.toString();
}

export function getCommunitySyncWebSocketUrl(
  websocketUrl: string,
  accessToken: string,
  communityId: string,
) {
  const url = new URL(websocketUrl);
  if (!url.searchParams.has('token')) {
    url.searchParams.set('token', accessToken);
  }
  if (!url.searchParams.has('community_id')) {
    url.searchParams.set('community_id', communityId);
  }
  return url.toString();
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }

  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
  return created;
}

export async function probeEndpoint(endpoint: "/healthz" | "/readyz"): Promise<EndpointProbe> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    const parsed = healthcheckResponseSchema.safeParse(payload);

    return {
      endpoint,
      ok: response.ok,
      statusCode: response.status,
      detail: parsed.success
        ? `${parsed.data.service} ${parsed.data.status}`
        : response.ok
          ? `HTTP ${response.status}`
          : `HTTP ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      endpoint,
      ok: false,
      statusCode: null,
      detail: error instanceof Error ? error.message : "Network error",
    };
  }
}

export async function createAnonymousSession(): Promise<AnonymousSessionResponse> {
  return requestJson(
    "/v1/auth/anonymous",
    {
      method: "POST",
      body: JSON.stringify({
        device_id: getOrCreateDeviceId(),
      }),
    },
    anonymousAuthResponseSchema,
  );
}

export async function refreshSession(refreshToken: string): Promise<AnonymousSessionResponse> {
  return requestJson(
    "/v1/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    },
    refreshSessionResponseSchema,
  );
}

export async function startOtp(accessToken: string, input: OtpStartInput): Promise<OtpStartResult> {
  return requestJson(
    "/v1/auth/otp/start",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        phone: input.phone,
      }),
    },
    otpStartResponseSchema,
  );
}

export async function verifyOtp(accessToken: string, input: OtpVerifyInput): Promise<AnonymousSessionResponse> {
  return requestJson(
    "/v1/auth/otp/verify",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        challenge_id: input.challengeId,
        code: input.code,
      }),
    },
    otpVerifyResponseSchema,
  );
}

export async function startMagicLink(
  accessToken: string,
  input: MagicLinkStartInput,
): Promise<MagicLinkStartResult> {
  return requestJson(
    "/v1/auth/magic-link/start",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email: input.email,
      }),
    },
    magicLinkStartResponseSchema,
  );
}

export async function verifyMagicLink(
  accessToken: string | null | undefined,
  input: MagicLinkVerifyInput,
): Promise<AnonymousSessionResponse> {
  const headers = accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : undefined;

  return requestJson(
    "/v1/auth/magic-link/verify",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        challenge_id: input.challengeId,
        token: input.token,
      }),
    },
    magicLinkVerifyResponseSchema,
  );
}

export async function searchResources(input: ResourceQueryInput): Promise<ResourcesResponse> {
  const params = new URLSearchParams({
    zip: input.zip,
  });

  if (input.openNow) {
    params.set("open_now", "true");
  }

  if (input.today) {
    params.set("today", "true");
  }

  if (input.type && input.type !== "all") {
    params.set("type", input.type);
  }

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  return requestJson(`/v1/resources?${params.toString()}`, {}, resourceListResponseSchema);
}

export async function getResource(providerId: string, zip?: string): Promise<ResourceDetail> {
  const suffix = zip ? `?zip=${encodeURIComponent(zip)}` : "";
  return requestJson(`/v1/resources/${providerId}${suffix}`, {}, resourceDetailSchema);
}

export async function listCommunityAnnouncements(
  accessToken: string,
  communityId: string,
): Promise<CommunityAnnouncementsResponse> {
  try {
    return await requestJson(
      `/v1/communities/${communityId}/announcements`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      {
        parse: parseCommunityAnnouncementsResponse,
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("HTTP 404") || error.message.includes("Unexpected end of JSON input"))
    ) {
      return {
        items: [],
        next_cursor: null,
      };
    }

    throw error;
  }
}

export async function resolveCommunityAccess(
  accessToken: string,
  input: CommunityAccessResolveInput,
): Promise<CommunityAccessResolveResult> {
  return requestJson(
    '/v1/community-access/resolve',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(
        input.inviteCode
          ? { invite_code: input.inviteCode }
          : { qr_token: input.qrToken },
      ),
    },
    communityAccessResolveResponseSchema,
  );
}

export async function joinCommunity(
  accessToken: string,
  communityId: string,
  joinToken: string,
): Promise<JoinCommunityResult> {
  return requestJson(
    `/v1/communities/${communityId}/join`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        join_token: joinToken,
      }),
    },
    joinCommunityResponseSchema,
  );
}

export async function getCommunityBootstrap(
  accessToken: string,
  communityId: string,
): Promise<CommunityBootstrapResponse> {
  return requestJson(
    `/v1/communities/${communityId}/bootstrap`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    {
      parse: (input) => parseCommunityBootstrapResponse(input, communityId),
    },
  );
}

export async function getCommunitySyncDelta(
  accessToken: string,
  communityId: string,
  input: { since?: string | null; limit?: number } = {},
): Promise<CommunitySyncDeltaResponse> {
  const params = new URLSearchParams();
  if (input.since) {
    params.set('since', input.since);
  }
  if (input.limit) {
    params.set('limit', String(input.limit));
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestJson(
    `/v1/communities/${communityId}/sync${suffix}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    {
      parse: (value) => parseCommunitySyncDeltaResponse(value, communityId),
    },
  );
}

export async function getMatchSuggestions(
  accessToken: string,
  postId: string,
  refresh = false,
): Promise<MatchResultsResponse> {
  const params = new URLSearchParams();
  if (refresh) {
    params.set('refresh', 'true');
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestJson(
    `/v1/posts/${postId}/matches${suffix}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    matchResultsResponseSchema,
  );
}

export async function createMatchContact(
  accessToken: string,
  input: MatchContactInput,
): Promise<MatchContactResult> {
  const payload = {
    from_post_id: input.fromPostId,
    to_post_id: input.toPostId,
  };
  matchContactRequestSchema.parse(payload);

  return requestJson(
    '/v1/match/contact',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    matchContactResponseSchema,
  );
}

export async function listContactRequestsInbox(
  accessToken: string,
  input: ContactRequestInboxInput = {},
): Promise<ContactRequestInboxResponse> {
  const params = new URLSearchParams();
  if (input.limit) {
    params.set('limit', String(input.limit));
  }
  if (input.cursor) {
    params.set('cursor', input.cursor);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestJson(
    `/v1/contact-requests/inbox${suffix}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    contactRequestInboxResponseSchema,
  );
}

export async function acceptContactRequest(
  accessToken: string,
  contactRequestId: string,
): Promise<ContactRequestDecisionResult> {
  return requestJson(
    `/v1/contact-requests/${contactRequestId}/accept`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    contactRequestDecisionResponseSchema,
  );
}

export async function rejectContactRequest(
  accessToken: string,
  contactRequestId: string,
): Promise<ContactRequestDecisionResult> {
  return requestJson(
    `/v1/contact-requests/${contactRequestId}/reject`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    contactRequestDecisionResponseSchema,
  );
}

export async function listConversations(
  accessToken: string,
  input: ConversationsListInput = {},
): Promise<ConversationsListResponse> {
  const params = new URLSearchParams();
  if (input.limit) {
    params.set('limit', String(input.limit));
  }
  if (input.cursor) {
    params.set('cursor', input.cursor);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestJson(
    `/v1/conversations${suffix}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    conversationsListResponseSchema,
  );
}

export async function getConversation(
  accessToken: string,
  conversationId: string,
): Promise<ConversationDetail> {
  return requestJson(
    `/v1/conversations/${conversationId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    conversationDetailSchema,
  );
}

export async function listConversationMessages(
  accessToken: string,
  conversationId: string,
  input: ConversationMessagesInput = {},
): Promise<ConversationMessagesResponse> {
  const params = new URLSearchParams();
  if (input.limit) {
    params.set('limit', String(input.limit));
  }
  if (input.cursor) {
    params.set('cursor', input.cursor);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestJson(
    `/v1/conversations/${conversationId}/messages${suffix}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    conversationMessagesResponseSchema,
  );
}

export async function sendConversationMessage(
  accessToken: string,
  input: SendConversationMessageInput,
): Promise<SendConversationMessageResult> {
  // Generate both a fresh `client_message_id` (used by the server-side
  // unique index `uq_messages_client_dedup` for DB-level dedup) AND an
  // `Idempotency-Key` header (used by the HTTP idempotency cache) the
  // first time we send. On retry the caller reuses the same values via
  // the `clientMessageId` / `idempotencyKey` fields. If the caller
  // doesn't supply either, we generate fresh UUIDs per call and the
  // server still gets a stable pair for this submission — a transient
  // network retry of THIS fetch will fall back to HTTP response-level
  // retry at the platform layer, not ours.
  const clientMessageId = input.clientMessageId ?? crypto.randomUUID();
  const idempotencyKey = input.idempotencyKey ?? clientMessageId;
  const payload = {
    body: input.body,
    client_message_id: clientMessageId,
  };
  sendConversationMessageRequestSchema.parse(payload);

  return requestJson(
    `/v1/conversations/${input.conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      idempotencyKey,
    },
    sendConversationMessageResponseSchema,
  );
}

export async function closeConversation(
  accessToken: string,
  conversationId: string,
): Promise<CloseConversationResult> {
  return requestJson(
    `/v1/conversations/${conversationId}/close`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    closeConversationResponseSchema,
  );
}

export async function blockUser(accessToken: string, input: BlockUserInput): Promise<BlockUserResult> {
  return requestJson(
    '/v1/blocks',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        blocked_user_id: input.blockedUserId,
        conversation_id: input.conversationId,
      }),
    },
    blockUserResponseSchema,
  );
}

export async function createReport(accessToken: string, input: ReportCreateInput): Promise<ReportCreateResult> {
  // A7 P0-3: send `Idempotency-Key` so a double-tap of "Report" produces
  // the same response and doesn't create two rows. The server's
  // `uq_reports_reporter_target_active` index is the second line of
  // defense if the cache has aged out.
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  return requestJson(
    '/v1/reports',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason,
        conversation_id: input.conversationId,
        evidence_description: input.evidenceDescription,
      }),
      idempotencyKey,
    },
    reportCreateResponseSchema,
  );
}

export async function createPost(accessToken: string, input: CreatePostInput): Promise<CreatePostResult> {
  // A7 P0-2: generate a fresh Idempotency-Key per publish-button-tap.
  // Callers that already track a draft via the offline outbox (PR #47)
  // should pass that `client_id` through `idempotencyKey` so retries of
  // the same draft collapse to one post. When omitted, a new UUID per
  // call is safe — the server only dedupes within the key's 24h TTL.
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  return requestJson(
    '/v1/posts',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        community_id: input.communityId,
        post_type: input.postType,
        category: input.category,
        title: input.title,
        body: input.body,
        language: input.language,
        location_zip: input.locationZip,
        privacy: input.privacy,
        expires_at: input.expiresAt,
        contact_pref: input.contactPref,
      }),
      idempotencyKey,
    },
    createPostResponseSchema,
  );
}

export async function listPosts(accessToken: string, input: PostListInput): Promise<PostsResponse> {
  const params = new URLSearchParams({
    scope: input.scope,
  });

  if (input.communityId) {
    params.set('community_id', input.communityId);
  }
  if (input.postType) {
    params.set('post_type', input.postType);
  }
  if (input.category) {
    params.set('category', input.category);
  }
  if (input.status) {
    params.set('status', input.status);
  }
  if (input.limit) {
    params.set('limit', String(input.limit));
  }
  if (input.cursor) {
    params.set('cursor', input.cursor);
  }

  return requestJson(
    `/v1/posts?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    postsListResponseSchema,
  );
}

export async function listMyPosts(accessToken: string, input: MyPostsInput = {}): Promise<PostsResponse> {
  const params = new URLSearchParams();
  if (input.communityId) {
    params.set('community_id', input.communityId);
  }
  if (input.status) {
    params.set('status', input.status);
  }
  if (input.limit) {
    params.set('limit', String(input.limit));
  }
  if (input.cursor) {
    params.set('cursor', input.cursor);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestJson(
    `/v1/posts/mine${suffix}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    myPostsResponseSchema,
  );
}

export async function getPost(accessToken: string, postId: string): Promise<PostDetail> {
  return requestJson(
    `/v1/posts/${postId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    postDetailSchema,
  );
}

export async function updatePost(
  accessToken: string,
  postId: string,
  input: UpdatePostInput,
): Promise<PostDetail> {
  updatePostRequestSchema.parse({
    category: input.category,
    title: input.title,
    body: input.body,
    language: input.language,
    location_zip: input.locationZip,
    privacy: input.privacy,
    expires_at: input.expiresAt,
    contact_pref: input.contactPref,
  });

  return requestJson(
    `/v1/posts/${postId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        category: input.category,
        title: input.title,
        body: input.body,
        language: input.language,
        location_zip: input.locationZip,
        privacy: input.privacy,
        expires_at: input.expiresAt,
        contact_pref: input.contactPref,
      }),
    },
    postDetailSchema,
  );
}

export async function closePost(accessToken: string, postId: string): Promise<PostDetail> {
  return requestJson(
    `/v1/posts/${postId}/close`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    postDetailSchema,
  );
}

export async function deletePost(accessToken: string, postId: string): Promise<PostDetail> {
  return requestJson(
    `/v1/posts/${postId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    postDetailSchema,
  );
}

export async function transcribeSpeech(
  accessToken: string,
  input: SpeechTranscribeInput,
): Promise<SpeechTranscribeResult> {
  const formData = new FormData();
  formData.set('audio', input.audio, input.fileName ?? 'voice-note.webm');
  formData.set('language', input.language);
  if (input.transcriptHint) {
    formData.set('transcript_hint', input.transcriptHint);
  }

  return requestJson(
    '/v1/speech/transcribe',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    },
    speechTranscribeResponseSchema,
  );
}

export async function deleteAccount(
  accessToken: string,
  input: AccountDeleteInput,
): Promise<AccountDeleteResult> {
  return requestJson(
    '/v1/account/delete',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        confirmation: input.confirmation,
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    },
    accountDeleteResponseSchema,
  );
}

/**
 * Step 1 of the 3-step account deletion flow introduced in M8 / W2A.
 * The server issues a single-use OTP / magic-link challenge bound to the
 * authenticated user; the caller then forwards the code back via
 * {@link confirmAccountDeletion}.
 */
export async function requestAccountDeletion(
  accessToken: string,
): Promise<AccountDeleteRequestResponse> {
  // Exported for API callers that want to parse/validate an empty request body
  // before issuing it; the actual POST body is always `{}` per the server
  // contract in `services/api-gateway/src/routes/account.ts`.
  void accountDeleteRequestRequestSchema;
  return requestJson(
    '/v1/account/delete/request',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    },
    accountDeleteRequestResponseSchema,
  );
}

export type ConfirmAccountDeletionInput = {
  challenge_id: string;
  code: string;
  reason?: AccountDeleteReason;
};

export type ConfirmAccountDeletionResult = AccountDeleteConfirmResponse & {
  undelete_recovery_token?: string;
};

/**
 * Step 2 of the deletion flow: verifies the challenge, runs the "last anchor"
 * safeguard server-side, soft-deletes the account, and returns the one-shot
 * recovery token the caller needs to keep in memory (not persistence) so the
 * user can undo within ~10 minutes.
 */
export async function confirmAccountDeletion(
  accessToken: string,
  input: ConfirmAccountDeletionInput,
): Promise<ConfirmAccountDeletionResult> {
  const payload: ConfirmAccountDeletionInput = {
    challenge_id: input.challenge_id,
    code: input.code,
    ...(input.reason ? { reason: input.reason } : {}),
  };
  accountDeleteConfirmRequestSchema.parse(payload);
  return requestJson(
    '/v1/account/delete/confirm',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    {
      parse: (value): ConfirmAccountDeletionResult => {
        const base = accountDeleteConfirmResponseSchema.parse(value);
        const recovery =
          typeof (value as { undelete_recovery_token?: unknown })
            ?.undelete_recovery_token === 'string'
            ? (value as { undelete_recovery_token: string })
                .undelete_recovery_token
            : undefined;
        return recovery ? { ...base, undelete_recovery_token: recovery } : base;
      },
    },
  );
}

export type UndeleteAccountInput = {
  user_id: string;
  recovery_token: string;
};

/**
 * Step 3 (optional): consumes the single-use recovery token to restore a
 * soft-deleted account within its 30-day window.
 *
 * The server endpoint is intentionally unauthenticated — after `confirmAccountDeletion`
 * the caller's sessions are revoked, so the undelete flow is gated by
 * possession of the single-use recovery_token. `accessToken` is accepted to
 * keep the shape consistent with the rest of the account helpers, and is
 * forwarded as a Bearer header only when non-empty.
 */
export async function undeleteAccount(
  accessToken: string,
  input: UndeleteAccountInput,
): Promise<AccountUndeleteConfirmResponse> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return requestJson(
    '/v1/account/undelete',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: input.user_id,
        recovery_token: input.recovery_token,
      }),
    },
    accountUndeleteConfirmResponseSchema,
  );
}

type RequestJsonOptions = RequestInit & {
  /**
   * When provided, the client sets the `Idempotency-Key` header on the
   * outgoing request. The server (api-gateway) uses this to cache the
   * first response for 24h and replay it verbatim on retry, which makes
   * our three critical write paths (post create, chat send, report submit)
   * safe against network retries + double-tap mistakes. Callers generate
   * a fresh `crypto.randomUUID()` per user-initiated action; retries
   * reuse the same key until the server confirms success.
   */
  idempotencyKey?: string;
};

async function requestJson<T>(
  path: string,
  init: RequestJsonOptions,
  schema: { parse(input: unknown): T },
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (init.idempotencyKey && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', init.idempotencyKey);
  }

  // Strip the non-standard idempotencyKey property from the init object
  // before forwarding to fetch so the DOM layer doesn't complain about
  // unknown fields. Everything else spreads through unchanged.
  const { idempotencyKey: _idempotencyKey, ...fetchInit } = init;
  void _idempotencyKey;

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    ...fetchInit,
    // Headers MUST be applied AFTER the init spread — otherwise init's own
    // headers stomp the Content-Type we just auto-injected, the request
    // goes out as text/plain, and every JSON-body POST returns 400. (This
    // is the root cause of the "nothing works" pilot outage — April 2026.)
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${path} failed: HTTP ${response.status} ${message}`.trim());
  }

  return schema.parse(await response.json());
}

export type {
  AnonymousSessionResponse,
  BlockUserResult,
  CloseConversationResult,
  ConversationDetail,
  ConversationMessagesResponse,
  ConversationsListResponse,
  ContactRequestInboxResponse,
  CommunityAnnouncementsResponse,
  CommunityBootstrapResponse,
  CommunitySyncDeltaResponse,
  MatchContactResult,
  MatchResultsResponse,
  PostDetail,
  PostsResponse,
  ReportCreateResult,
  ResourceDetail,
  ResourcesResponse,
  SendConversationMessageResult,
} from '@/lib/types';
