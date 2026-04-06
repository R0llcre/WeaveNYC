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
  issued_via?: "anonymous" | "otp" | "magic_link" | "refresh";
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

export type PreferencesState = {
  language: SupportedLanguage;
  zipCode: string;
  onboardingComplete: boolean;
  lowBandwidth: boolean;
  bookmarks: string[];
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
