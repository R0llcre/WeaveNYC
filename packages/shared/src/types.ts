export type UserLevel = "anonymous" | "verified" | "anchor";

export type Role = "user" | "anchor";

export type AnonymousSessionUser = {
  user_id: string;
  level: UserLevel;
};

export type AuthenticatedSessionUser = {
  user_id: string;
  level: UserLevel;
  role: Role;
  community_ids: string[];
};

export type AnonymousSessionRequest = {
  device_id: string;
};

export type RefreshSessionRequest = {
  refresh_token: string;
};

export type AuthSessionResponse = {
  access_token: string;
  refresh_token: string;
  user: AnonymousSessionUser;
  issued_via?: "anonymous" | "otp" | "magic_link" | "refresh";
  fallback?: boolean;
};

export type AnonymousSessionResponse = AuthSessionResponse;

export type OtpStartRequest = {
  phone: string;
};

export type OtpStartResponse = {
  challenge_id: string;
  masked_destination: string;
  delivery_channel: "sms";
  expires_in_seconds: number;
  fallback: boolean;
  demo_code?: string;
};

export type OtpVerifyRequest = {
  challenge_id: string;
  code: string;
};

export type MagicLinkStartRequest = {
  email: string;
};

export type MagicLinkStartResponse = {
  challenge_id: string;
  masked_destination: string;
  delivery_channel: "email";
  expires_in_seconds: number;
  fallback: boolean;
  demo_token?: string;
  demo_url?: string;
};

export type MagicLinkVerifyRequest = {
  challenge_id: string;
  token: string;
};

export type JwtClaims = {
  sub: string;
  level: UserLevel;
  role: Role;
  community_ids: string[];
  iat?: number;
  exp?: number;
};

export type EndpointName = "/healthz" | "/readyz";

export type EndpointProbe = {
  endpoint: EndpointName;
  ok: boolean;
  statusCode: number | null;
  detail: string;
};

export type HealthResponse = {
  status: "ok";
  service: "api-gateway";
  timestamp: string;
};

export type ReadinessDependency = {
  name: "postgres" | "redis";
  status: "ok" | "degraded" | "unavailable";
  latency_ms?: number;
  detail?: string;
};

export type ReadinessResponse = {
  status: "ok" | "degraded" | "unavailable";
  service: "api-gateway";
  timestamp: string;
  checks: ReadinessDependency[];
};

export type MeResponse = {
  user: AuthenticatedSessionUser;
};

export type ErrorResponse = {
  message: string;
};

export type ResourceType = "pantry" | "kitchen" | "market" | "benefits" | "other";

export type GeoPrecision = "exact" | "rooftop" | "street" | "zip_centroid" | "unknown";

export type ResourceHoursEntry = {
  day: string;
  windows: Array<{
    opens_at: string;
    closes_at: string;
  }>;
  closed: boolean;
};

export type ResourceSummary = {
  provider_id: string;
  name: string;
  type: ResourceType;
  address: string;
  city: string | null;
  state: string | null;
  zip: string;
  phone: string | null;
  languages: string[];
  source: string;
  source_label: string | null;
  notes: string | null;
  distance_miles: number | null;
  is_open_today: boolean;
  is_open_now: boolean;
  geo_precision: GeoPrecision;
  directions_url: string;
};

export type ResourceDetail = ResourceSummary & {
  weekly_hours: ResourceHoursEntry[];
  source_url: string | null;
};

export type ResourceListResponse = {
  items: ResourceSummary[];
  next_cursor: string | null;
  source_mode: "api" | "fixture";
};

export type ResourceSearchRequest = {
  zip: string;
  open_now?: boolean;
  today?: boolean;
  type?: ResourceType;
  limit?: number;
  cursor?: string | null;
};

export type SupportedLanguage = "en" | "es" | "zh";

export type JoinPolicy = "invite_only" | "open";

export type CommunityAccessEntry = "invite_code" | "qr_token";

export type MembershipStatus = "joined" | "already_joined";

export type PostType = "request" | "offer";

export type PostCategory =
  | "food"
  | "goods"
  | "childcare"
  | "companionship"
  | "translation"
  | "transportation"
  | "other";

export type PrivacyOption = "community_only" | "public" | "anchor_mediated";

export type PostStatus = "draft" | "pending_review" | "active" | "fulfilled" | "closed" | "removed";

export type RiskLevel = "low" | "medium" | "high";

export type PostScope = "community" | "public";

export type ReviewDecision = "approve" | "reject" | "request_more_info";

export type SpeechProvider = "browser" | "server_fallback";

export type CommunitySummary = {
  community_id: string;
  name: string;
  center_zip: string;
  join_policy: JoinPolicy;
};

export type CommunityAccessResolveRequest =
  | {
      invite_code: string;
      qr_token?: never;
    }
  | {
      invite_code?: never;
      qr_token: string;
    };

export type CommunityAccessResolveResponse = {
  community: CommunitySummary;
  join_token: string;
  entry: CommunityAccessEntry;
  expires_in_seconds: number;
};

export type JoinCommunityRequest = {
  join_token: string;
};

export type JoinCommunityResponse = {
  community_id: string;
  membership_status: MembershipStatus;
  joined_at: string;
};

export type ContactPreference = {
  in_app_chat?: boolean;
  call?: boolean;
  text?: boolean;
  notes?: string;
};

export type CreatePostRequest = {
  community_id: string;
  post_type: PostType;
  category: PostCategory;
  title: string;
  body: string;
  language: SupportedLanguage;
  location_zip: string;
  privacy: PrivacyOption;
  expires_at: string;
  contact_pref?: ContactPreference;
};

export type CreatePostResponse = {
  post_id: string;
  status: PostStatus;
  risk_level: RiskLevel;
};

export type UpdatePostRequest = Partial<Omit<CreatePostRequest, "community_id" | "post_type">>;

export type PostActions = {
  can_edit: boolean;
  can_close: boolean;
  can_delete: boolean;
  can_review: boolean;
};

export type PostSummary = {
  post_id: string;
  community_id: string;
  post_type: PostType;
  category: PostCategory;
  title: string;
  body: string;
  language: SupportedLanguage;
  location_zip: string;
  privacy: PrivacyOption;
  status: PostStatus;
  risk_level: RiskLevel;
  created_at: string;
  updated_at: string;
  expires_at: string;
  is_owner: boolean;
};

export type PostDetail = PostSummary & {
  contact_pref: ContactPreference | null;
  actions: PostActions;
};

export type PostsListRequest = {
  scope: PostScope;
  community_id?: string;
  post_type?: PostType;
  category?: PostCategory;
  status?: PostStatus;
  cursor?: string | null;
  limit?: number;
};

export type PostMineRequest = {
  community_id?: string;
  status?: PostStatus;
  cursor?: string | null;
  limit?: number;
};

export type PostsListResponse = {
  items: PostSummary[];
  next_cursor: string | null;
};

export type MyPostsResponse = PostsListResponse;

export type ReviewQueueItem = PostSummary & {
  review_actions: ReviewDecision[];
};

export type ReviewQueueResponse = {
  items: ReviewQueueItem[];
  next_cursor: string | null;
};

export type ReviewDecisionRequest = {
  decision: ReviewDecision;
  notes?: string;
};

export type ReviewDecisionResponse = {
  post_id: string;
  status: PostStatus;
  decided_at: string;
};

export type SpeechTranscribeResponse = {
  transcript: string;
  language: SupportedLanguage;
  provider: SpeechProvider;
};

export type MatchCandidateType = "neighbor_post" | "official_resource";

export type MatchReason =
  | "same_category"
  | "same_language"
  | "within_1_mile"
  | "within_3_miles"
  | "within_5_miles"
  | "verified_user"
  | "anchor_reviewed"
  | "expires_soon"
  | "open_now"
  | "open_today"
  | "nearby_resource"
  | "language_supported";

export type MatchSuggestion = {
  suggestion_id: string;
  batch_number: number;
  position: number;
  candidate_type: MatchCandidateType;
  candidate_id: string;
  score: number;
  reasons: MatchReason[];
  distance_miles: number | null;
  neighbor_post: PostSummary | null;
  official_resource: ResourceSummary | null;
};

export type MatchResultsResponse = {
  post_id: string;
  batch_number: number;
  advanced: boolean;
  refreshes_used: number;
  max_refreshes: number;
  items: MatchSuggestion[];
};

export type MatchContactRequest = {
  from_post_id: string;
  to_post_id: string;
};

export type MatchContactResponse = {
  contact_request_id: string;
  status: "pending" | "accepted";
  conversation_id?: string;
};

export type ContactRequestStatus = "pending" | "accepted" | "rejected" | "expired" | "cancelled";

export type ContactRequestInboxItem = {
  contact_request_id: string;
  from_post_id: string;
  to_post_id: string;
  requester_user_id: string;
  requester_alias: string;
  status: ContactRequestStatus;
  created_at: string;
  expires_at: string;
  from_post_title: string;
  to_post_title: string;
  from_post_category: PostCategory;
  to_post_category: PostCategory;
};

export type ContactRequestInboxResponse = {
  items: ContactRequestInboxItem[];
  next_cursor: string | null;
};

export type ContactRequestDecisionResponse = {
  contact_request_id: string;
  status: "accepted" | "rejected";
  responded_at: string;
  conversation_id?: string;
};

export type ConversationParticipantPreview = {
  user_id: string;
  alias: string;
};

export type ConversationStatus = "active" | "closed" | "blocked";

export type ConversationSummary = {
  conversation_id: string;
  contact_request_id: string;
  related_post_ids: string[];
  participant_preview: ConversationParticipantPreview[];
  status: ConversationStatus;
  created_at: string;
  last_activity_at: string;
  last_message_preview: string | null;
  unread_count: number;
};

export type ConversationDetail = ConversationSummary & {
  other_user_id: string;
  actions: {
    can_send: boolean;
    can_close: boolean;
    can_block: boolean;
    can_report: boolean;
  };
};

export type ConversationsListResponse = {
  items: ConversationSummary[];
  next_cursor: string | null;
};

export type ConversationMessage = {
  message_id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_alias: string;
  body: string;
  sent_at: string;
  is_mine: boolean;
  safety_flags: MessageSafetyFlag[];
};

export type ConversationMessagesResponse = {
  items: ConversationMessage[];
  next_cursor: string | null;
};

export type SendConversationMessageRequest = {
  body: string;
};

export type SendConversationMessageResponse = {
  conversation_id: string;
  message: ConversationMessage;
};

export type CloseConversationResponse = {
  conversation_id: string;
  status: "closed";
  closed_at: string;
};

export type BlockUserRequest = {
  blocked_user_id: string;
  conversation_id?: string;
};

export type BlockUserResponse = {
  blocked_user_id: string;
  status: "blocked";
  blocked_at: string;
  affected_conversation_ids: string[];
};

export type ReportTargetType = "post" | "user" | "message";

export type ReportReason =
  | "harassment"
  | "scam"
  | "misinformation"
  | "unsafe_behavior"
  | "other";

export type ReportCreateRequest = {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  conversation_id?: string;
  evidence_description?: string;
};

export type ReportCreateResponse = {
  report_id: string;
  status: "new";
  created_at: string;
};

export type MessageSafetyFlag =
  | "sensitive_ssn"
  | "sensitive_phone"
  | "sensitive_address"
  | "sensitive_bank_account"
  | "keyword_passport"
  | "keyword_bank"
  | "keyword_wire"
  | "keyword_crypto"
  | "keyword_gift_card";

export type MessageSafetyErrorResponse = {
  message: string;
  blocked: true;
  safety_flags: MessageSafetyFlag[];
};

export type ChatRealtimeEventType = "message.created" | "conversation.updated" | "heartbeat";

export type ChatRealtimeEvent =
  | {
      event_type: "message.created";
      occurred_at: string;
      conversation_id: string;
      message: ConversationMessage;
    }
  | {
      event_type: "conversation.updated";
      occurred_at: string;
      conversation: ConversationSummary;
    }
  | {
      event_type: "heartbeat";
      occurred_at: string;
    };
