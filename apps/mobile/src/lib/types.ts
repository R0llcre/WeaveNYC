/**
 * Mobile-local persistence types.
 *
 * Wave B M6 port of the PWA's `apps/pwa/src/lib/types.ts` — the subset
 * that `persistence.ts` and `db.ts` actually reference. We intentionally
 * keep these co-located with the persistence layer (not hoisted into
 * `@weavenyc/shared`) because:
 *
 *   - The mobile runtime is still scaffolding. Wave C / D atoms + screens
 *     will need a broader shared-types surface; trying to design that now
 *     would either underspecify or bloat the shared package.
 *   - The PWA's types.ts bundles UI/routing concerns (HomeIntent,
 *     ResourceFilterType) that have no meaning on the native side.
 *   - We reuse the wire-format types from `@weavenyc/shared`
 *     (`CommunitySyncEvent`, `PostSummary`, `CommunityAnnouncement`-like
 *     shapes) so the persistence replay logic stays byte-compatible with
 *     the backend's authoritative schema.
 *
 * When Wave C ports atoms that render Post / Announcement content, the
 * same types below can be lifted to a top-level `apps/mobile/src/lib`
 * module without touching call sites.
 */

import type {
  CommunityLatestSnapshot,
  CommunitySummary,
  CommunitySyncDeltaResponse,
  CommunitySyncEvent,
  PostCategory,
  PostScope,
  PostStatus,
  PostType,
  PrivacyOption as PostPrivacy,
  RiskLevel,
  SupportedLanguage,
} from "@weavenyc/shared";

export type {
  CommunityLatestSnapshot,
  CommunitySummary,
  CommunitySyncDeltaResponse,
  CommunitySyncEvent,
  PostCategory,
  PostScope,
  PostStatus,
  PostType,
  PostPrivacy,
  RiskLevel,
  SupportedLanguage,
};

export type UserLevel = "anonymous" | "verified" | "anchor";

export type AuthUser = {
  user_id: string;
  level: UserLevel;
};

/**
 * Full session — access_token is memory-only (volatile) and NEVER written
 * to storage. On mobile the refresh_token lands in `expo-secure-store`
 * (hardware-encrypted Keychain/KeyStore), matching the PWA's invariant
 * that the 15-min bearer cannot survive a process kill.
 */
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

export type DefaultPostVisibility = "community_only" | "public";
export type LocationPrecision = "exact" | "zip_centroid";
export type HomeIntent = "food_now" | "food_week" | "doctor" | "sleep";

export type PreferencesState = {
  language: SupportedLanguage;
  zipCode: string;
  onboardingComplete: boolean;
  lowBandwidth: boolean;
  bookmarks: string[];
  defaultPostVisibility: DefaultPostVisibility;
  locationPrecision: LocationPrecision;
  hasUserChosenLanguage: boolean;
  trustBannerDismissed: boolean;
  /**
   * Transient UI-only flag flipped once the async load completes. Not
   * persisted — `savePreferences` strips it out.
   */
  hydrationComplete: boolean;
  lastIntent: HomeIntent | null;
};

export type JoinedCommunity = {
  community: CommunitySummary;
  joinedAt: string;
};

export type CommunityJoinPreview = {
  community: CommunitySummary;
  joinToken: string;
  entry: "invite_code" | "qr_token";
  expiresInSeconds: number;
};

export type CommunityState = {
  currentCommunityId: string | null;
  joinedCommunities: JoinedCommunity[];
  joinPreview: CommunityJoinPreview | null;
};

/**
 * Mobile-local announcement shape. Aligned with the PWA's
 * `CommunityAnnouncement` (loose / nullable metadata fields) rather
 * than the shared package's strict `Announcement` wire shape — the
 * cache must round-trip partial records the sync replay synthesises
 * for tombstones.
 */
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
  idempotencyKey?: string;
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
  privacy: PostPrivacy;
  status: PostStatus;
  risk_level: RiskLevel;
  created_at: string;
  updated_at: string;
  expires_at: string;
  is_owner: boolean;
  p2p_version?: number | null;
};

export type P2PTransportLabel = "bootstrap" | "mdns-demo";
export type P2PSyncPhase =
  | "disabled"
  | "connecting"
  | "ready"
  | "degraded"
  | "offline"
  | "auth_required"
  | "forbidden";
export type P2PSyncErrorCategory =
  | "auth"
  | "network"
  | "server"
  | "schema"
  | "unknown";
export type P2PSyncSource = "network" | "cache";

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

/**
 * Client-local sync status — richer than the wire-format
 * `@weavenyc/shared::P2PSyncStatus`, tracking transient UI-only fields
 * like `phase`, `errorCategory`, and `lastError` that live alongside the
 * protocol-level `peer_count` / `last_synced_at`.
 */
export type P2PSyncStatus = {
  communityId: string;
  enabled: boolean;
  mdnsDemoEnabled: boolean;
  phase: P2PSyncPhase;
  peerId: string | null;
  peerCount: number;
  transportLabel: P2PTransportLabel;
  lastSyncAt: string | null;
  latestSnapshot: CommunityLatestSnapshot | null;
  lastError: string | null;
  errorCategory?: P2PSyncErrorCategory | null;
};

export type PostDraftStep = "type" | "compose" | "preview";

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
