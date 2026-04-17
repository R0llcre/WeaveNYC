export type UserLevel = "anonymous" | "verified" | "anchor";
export type SupportedLanguage = "en" | "es" | "zh";
export type ResourceFilterType = "all" | "pantry" | "kitchen" | "market" | "benefits" | "other";
export type GeoPrecision = "exact" | "rooftop" | "street" | "zip_centroid" | "unknown";

export type AuthUser = {
  user_id: string;
  level: UserLevel;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
  issued_via?:
    | "anonymous"
    | "otp"
    | "magic_link"
    | "refresh"
    | "anchor_activate"
    | "anchor_session";
  fallback?: boolean;
};

export type AnonymousSessionResponse = AuthSession;

export type EndpointProbe = {
  endpoint: "/healthz" | "/readyz";
  ok: boolean;
  statusCode: number | null;
  detail: string;
};

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
  type: Exclude<ResourceFilterType, "all">;
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
  is_open_now: boolean;
  is_open_today: boolean;
  geo_precision: GeoPrecision;
  directions_url: string;
};

export type ResourceDetail = ResourceSummary & {
  weekly_hours: ResourceHoursEntry[];
  source_url: string | null;
};

export type ResourcesResponse = {
  items: ResourceSummary[];
  next_cursor: string | null;
  source_mode: "api" | "fixture";
};

export type ResourceQueryInput = {
  zip: string;
  openNow?: boolean;
  today?: boolean;
  type?: ResourceFilterType;
  limit?: number;
  cursor?: string | null;
};

export type DefaultPostVisibility = "community_only" | "public" | "anchor_mediated";
export type LocationPrecision = "zip_only" | "zip_and_neighborhood";

export type PreferencesState = {
  language: SupportedLanguage;
  zipCode: string;
  onboardingComplete: boolean;
  lowBandwidth: boolean;
  bookmarks: string[];
  defaultPostVisibility: DefaultPostVisibility;
  locationPrecision: LocationPrecision;
};

export type OtpStartInput = {
  phone: string;
};

export type OtpStartResult = {
  challenge_id: string;
  masked_destination: string;
  delivery_channel: "sms";
  expires_in_seconds: number;
  fallback: boolean;
  demo_code?: string;
};

export type OtpVerifyInput = {
  challengeId: string;
  code: string;
};

export type MagicLinkStartInput = {
  email: string;
};

export type MagicLinkStartResult = {
  challenge_id: string;
  masked_destination: string;
  delivery_channel: "email";
  expires_in_seconds: number;
  fallback: boolean;
  demo_token?: string;
  demo_url?: string;
};

export type MagicLinkVerifyInput = {
  challengeId: string;
  token: string;
};

export type CommunityAccessEntry = 'invite_code' | 'qr_token';
export type JoinPolicy = 'invite_only' | 'open';
export type MembershipStatus = 'joined' | 'already_joined';
export type PostType = 'request' | 'offer';
export type PostCategory =
  | 'food'
  | 'goods'
  | 'childcare'
  | 'companionship'
  | 'translation'
  | 'transportation'
  | 'other';
export type PostPrivacy = 'community_only' | 'public' | 'anchor_mediated';
export type PostStatus = 'draft' | 'pending_review' | 'active' | 'fulfilled' | 'closed' | 'removed';
export type RiskLevel = 'low' | 'medium' | 'high';
export type PostScope = 'community' | 'public';
export type SpeechProvider = 'browser' | 'server_fallback';

export type CommunitySummary = {
  community_id: string;
  name: string;
  center_zip: string;
  join_policy: JoinPolicy;
};

export type JoinedCommunity = {
  community: CommunitySummary;
  joinedAt: string;
};

export type CommunityJoinPreview = {
  community: CommunitySummary;
  joinToken: string;
  entry: CommunityAccessEntry;
  expiresInSeconds: number;
};

export type CommunityState = {
  currentCommunityId: string | null;
  joinedCommunities: JoinedCommunity[];
  joinPreview: CommunityJoinPreview | null;
};

export type CommunityAnnouncement = {
  announcement_id: string;
  community_id: string;
  title: string;
  body: string;
  p2p_version?: number | null;
  is_pinned: boolean;
  status?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type CommunityAnnouncementsResponse = {
  items: CommunityAnnouncement[];
  next_cursor: string | null;
};

export type P2PTransportLabel = 'bootstrap' | 'mdns-demo';
export type P2PSyncPhase = 'disabled' | 'connecting' | 'ready' | 'degraded' | 'offline';
export type P2PSyncSource = 'network' | 'cache';
export type CommunitySyncEventType =
  | 'post.published'
  | 'post.updated'
  | 'post.tombstoned'
  | 'announcement.published'
  | 'announcement.updated'
  | 'announcement.deleted'
  | 'report.created'
  | 'moderation.decision';
export type CommunitySyncAggregateType = 'post' | 'announcement' | 'report' | 'moderation';

export type CommunityBootstrapNode = {
  node_id: string;
  websocket_url: string;
  last_published_at?: string | null;
};

export type CommunitySnapshot = {
  last_event_at: string | null;
  event_count: number;
};

export type P2PTopicMap = {
  posts: string;
  announcements: string;
  reports: string;
};

export type CommunityBootstrapResponse = {
  community_id: string;
  bootstrap_version: string;
  anchor_node: CommunityBootstrapNode | null;
  relay_nodes: CommunityBootstrapNode[];
  topics: P2PTopicMap;
  latest_snapshot: CommunitySnapshot | null;
  mdns_demo_enabled: boolean;
};

export type CommunitySyncEvent = {
  sync_event_id: string;
  community_id: string;
  event_type: CommunitySyncEventType;
  aggregate_type: CommunitySyncAggregateType;
  aggregate_id: string;
  actor_p2p_id: string | null;
  payload: Record<string, unknown> | null;
  cid: string | null;
  occurred_at: string;
};

export type CommunitySyncDeltaResponse = {
  events: CommunitySyncEvent[];
  next_since: string | null;
  server_time: string;
  latest_snapshot: CommunitySnapshot | null;
};

export type P2PKeyMaterial = {
  communityId: string;
  peerId: string;
  createdAt: string;
};

export type P2PEventCursor = {
  communityId: string;
  since: string | null;
  updatedAt: string;
};

export type CachedPostsValue = {
  communityId: string;
  scope: PostScope;
  items: PostSummary[];
  next_cursor: string | null;
  updatedAt: string;
  source: P2PSyncSource;
};

export type CachedAnnouncementsValue = {
  communityId: string;
  items: CommunityAnnouncement[];
  next_cursor: string | null;
  updatedAt: string;
  source: P2PSyncSource;
};

export type P2PSyncStatus = {
  communityId: string;
  enabled: boolean;
  mdnsDemoEnabled: boolean;
  phase: P2PSyncPhase;
  peerId: string | null;
  peerCount: number;
  transportLabel: P2PTransportLabel;
  lastSyncAt: string | null;
  latestSnapshot: CommunitySnapshot | null;
  lastError: string | null;
};

export type ContactPreference = {
  in_app_chat?: boolean;
  call?: boolean;
  text?: boolean;
  notes?: string;
};

export type CreatePostInput = {
  communityId: string;
  postType: PostType;
  category: PostCategory;
  title: string;
  body: string;
  language: SupportedLanguage;
  locationZip: string;
  privacy: PostPrivacy;
  expiresAt: string;
  contactPref?: ContactPreference;
};

export type UpdatePostInput = Partial<Omit<CreatePostInput, 'communityId' | 'postType'>>;

export type PostSummary = {
  post_id: string;
  community_id: string;
  post_type: PostType;
  category: PostCategory;
  title: string;
  body: string;
  language: SupportedLanguage;
  location_zip: string;
  privacy: PostPrivacy;
  status: PostStatus;
  risk_level: RiskLevel;
  created_at: string;
  updated_at: string;
  expires_at: string;
  is_owner: boolean;
  p2p_version?: number | null;
};

export type PostDetail = PostSummary & {
  contact_pref: ContactPreference | null;
  actions: {
    can_edit: boolean;
    can_close: boolean;
    can_delete: boolean;
    can_review: boolean;
  };
};

export type PostListInput = {
  scope: PostScope;
  communityId?: string;
  postType?: PostType;
  category?: PostCategory;
  status?: PostStatus;
  cursor?: string | null;
  limit?: number;
};

export type MyPostsInput = {
  communityId?: string;
  status?: PostStatus;
  cursor?: string | null;
  limit?: number;
};

export type PostsResponse = {
  items: PostSummary[];
  next_cursor: string | null;
};

export type ReviewQueueItem = PostSummary & {
  review_actions: Array<'approve' | 'reject' | 'request_more_info'>;
};

export type ReviewQueueResponse = {
  items: ReviewQueueItem[];
  next_cursor: string | null;
};

export type ReviewDecisionInput = {
  decision: 'approve' | 'reject' | 'request_more_info';
  notes?: string;
};

export type CommunityAccessResolveInput =
  | {
      inviteCode: string;
      qrToken?: never;
    }
  | {
      inviteCode?: never;
      qrToken: string;
    };

export type CommunityAccessResolveResult = {
  community: CommunitySummary;
  join_token: string;
  entry: CommunityAccessEntry;
  expires_in_seconds: number;
};

export type JoinCommunityResult = {
  community_id: string;
  membership_status: MembershipStatus;
  joined_at: string;
};

export type CreatePostResult = {
  post_id: string;
  status: PostStatus;
  risk_level: RiskLevel;
};

export type PostDraftStep = 'type' | 'compose' | 'preview';

export type PostDraftState = {
  step: PostDraftStep;
  postType: PostType | null;
  category: PostCategory;
  title: string;
  body: string;
  language: SupportedLanguage;
  locationZip: string;
  privacy: PostPrivacy;
  expiresAt: string;
  contactPref: {
    inAppChat: boolean;
    call: boolean;
    text: boolean;
    notes: string;
  };
};

export type SpeechTranscribeInput = {
  audio: Blob;
  language: SupportedLanguage;
  transcriptHint?: string;
  fileName?: string;
};

export type SpeechTranscribeResult = {
  transcript: string;
  language: SupportedLanguage;
  provider: SpeechProvider;
};

export type MatchCandidateType = 'neighbor_post' | 'official_resource';

export type MatchReason =
  | 'same_category'
  | 'same_language'
  | 'within_1_mile'
  | 'within_3_miles'
  | 'within_5_miles'
  | 'verified_user'
  | 'anchor_reviewed'
  | 'expires_soon'
  | 'open_now'
  | 'open_today'
  | 'nearby_resource'
  | 'language_supported';

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

export type MatchContactInput = {
  fromPostId: string;
  toPostId: string;
};

export type MatchContactResult = {
  contact_request_id: string;
  status: 'pending' | 'accepted';
  conversation_id?: string;
};

export type ContactRequestDecisionResult = {
  contact_request_id: string;
  status: 'accepted' | 'rejected';
  responded_at: string;
  conversation_id?: string;
};

export type ContactRequestStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export type ContactRequestInboxInput = {
  cursor?: string | null;
  limit?: number;
};

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

export type ConversationParticipantPreview = {
  user_id: string;
  alias: string;
};

export type ConversationStatus = 'active' | 'closed' | 'blocked';
export type ReportTargetType = 'post' | 'user' | 'message';
export type ReportReason = 'harassment' | 'scam' | 'misinformation' | 'unsafe_behavior' | 'other';
export type MessageSafetyFlag =
  | 'sensitive_ssn'
  | 'sensitive_phone'
  | 'sensitive_address'
  | 'sensitive_bank_account'
  | 'keyword_passport'
  | 'keyword_bank'
  | 'keyword_wire'
  | 'keyword_crypto'
  | 'keyword_gift_card';
export type ChatRealtimeEventType = 'message.created' | 'conversation.updated' | 'heartbeat';

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

export type ConversationsListInput = {
  cursor?: string | null;
  limit?: number;
};

export type ConversationsListResponse = {
  items: ConversationSummary[];
  next_cursor: string | null;
};

export type ConversationMessagesInput = {
  cursor?: string | null;
  limit?: number;
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

export type SendConversationMessageInput = {
  conversationId: string;
  body: string;
};

export type SendConversationMessageResult = {
  conversation_id: string;
  message: ConversationMessage;
};

export type CloseConversationResult = {
  conversation_id: string;
  status: 'closed';
  closed_at: string;
};

export type BlockUserInput = {
  blockedUserId: string;
  conversationId?: string;
};

export type BlockUserResult = {
  blocked_user_id: string;
  status: 'blocked';
  blocked_at: string;
  affected_conversation_ids: string[];
};

export type ReportCreateInput = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  conversationId?: string;
  evidenceDescription?: string;
};

export type ReportCreateResult = {
  report_id: string;
  status: 'new';
  created_at: string;
};

export type MessageSafetyError = {
  message: string;
  blocked: true;
  safety_flags: MessageSafetyFlag[];
};

export type ChatRealtimeEvent =
  | {
      event_type: 'message.created';
      occurred_at: string;
      conversation_id: string;
      message: ConversationMessage;
    }
  | {
      event_type: 'conversation.updated';
      occurred_at: string;
      conversation: ConversationSummary;
    }
  | {
      event_type: 'heartbeat';
      occurred_at: string;
    };

export type MatchContactIntent = {
  kind: 'match_contact';
  fromPostId: string;
  toPostId: string;
  targetTitle: string;
  returnTo: string;
  createdAt: string;
};

export type AccountDeleteReason =
  | 'no_longer_needed'
  | 'privacy_concerns'
  | 'moving_away'
  | 'safety_concerns'
  | 'other';

export type AccountDeleteInput = {
  confirmation: 'DELETE_MY_ACCOUNT';
  reason?: AccountDeleteReason;
};

export type AccountDeleteResult = {
  status: 'deletion_scheduled';
  purge_date: string;
  user_id: string;
};
