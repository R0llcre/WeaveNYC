import {
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
  const payload = {
    body: input.body,
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
    },
    reportCreateResponseSchema,
  );
}

export async function createPost(accessToken: string, input: CreatePostInput): Promise<CreatePostResult> {
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

async function requestJson<T>(
  path: string,
  init: RequestInit,
  schema: { parse(input: unknown): T },
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    headers,
    ...init,
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
  MatchContactResult,
  MatchResultsResponse,
  PostDetail,
  PostsResponse,
  ReportCreateResult,
  ResourceDetail,
  ResourcesResponse,
  SendConversationMessageResult,
} from '@/lib/types';
