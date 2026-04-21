export type UserLevel = "anonymous" | "verified" | "anchor";

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

export type SupportedLanguage = "en" | "es" | "zh";

export type ResourceType = "pantry" | "kitchen" | "market" | "benefits" | "other";

export type GeoPrecision = "exact" | "rooftop" | "street" | "zip_centroid" | "unknown";

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

export type ContactRequestStatus = "pending" | "accepted" | "rejected" | "expired" | "cancelled";

export type MatchActor = {
  userId: string;
  level: UserLevel;
  alias?: string;
  communityIds: string[];
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

export type MatchablePost = PostSummary & {
  created_by: string;
  author_alias: string;
  author_level: UserLevel;
  anchor_reviewed: boolean;
  distance_miles: number | null;
};

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
  max_refreshes: 1;
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

export type ContactRequestRecord = {
  contactRequestId: string;
  fromPostId: string;
  toPostId: string;
  requesterUserId: string;
  recipientUserId: string;
  requesterAlias: string;
  status: ContactRequestStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
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

export type ContactRequestInboxRow = ContactRequestRecord & {
  fromPostTitle: string;
  toPostTitle: string;
  fromPostCategory: PostCategory;
  toPostCategory: PostCategory;
};

export type ContactRequestDecisionResponse = {
  contact_request_id: string;
  status: "accepted" | "rejected";
  responded_at: string;
  conversation_id?: string;
  /**
   * True when this call transitioned the request from `pending` → `accepted`.
   * Re-accepting an already-accepted request (idempotent replay) returns
   * false so downstream metric/analytics counters only fire on the fresh
   * transition. Undefined on `rejected` responses (not meaningful there).
   */
  is_new_accept?: boolean;
};

export type ConversationParticipantPreview = {
  user_id: string;
  alias: string;
};

export type AcceptedConversationRecord = {
  conversation_id: string;
  contact_request_id: string;
  related_post_ids: string[];
  participant_preview: ConversationParticipantPreview[];
  status: "accepted_contact";
  created_at: string;
};

export type MatchSuggestionBatch = {
  requestPostId: string;
  batchNumber: number;
  createdAt: string;
  items: MatchSuggestion[];
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type ListInboxInput = {
  actor: MatchActor;
  cursor?: string | null;
  limit?: number;
};

export type GetSuggestionsInput = {
  actor: MatchActor;
  postId: string;
  refresh?: boolean;
};

export type AcceptContactRequestInput = {
  actor: MatchActor;
  contactRequestId: string;
};

export type RejectContactRequestInput = {
  actor: MatchActor;
  contactRequestId: string;
};

export type GetAcceptedConversationInput = {
  actor: MatchActor;
  conversationId: string;
};

export interface MatchRepository {
  close(): Promise<void>;
  getPost(postId: string): Promise<MatchablePost | null>;
  listCandidateNeighborPosts(requestPost: MatchablePost): Promise<MatchablePost[]>;
  listOfficialResourcesForRequest(requestPost: MatchablePost): Promise<ResourceSummary[]>;
  listSuggestionBatches(requestPostId: string): Promise<MatchSuggestionBatch[]>;
  saveSuggestionBatch(batch: MatchSuggestionBatch): Promise<void>;
  deleteSuggestionBatches(requestPostId: string, batchNumbers?: number[]): Promise<void>;
  /**
   * True if `userA` has blocked `userB`, OR `userB` has blocked `userA`.
   * Mirrors the chat-service predicate (pg-repository `findBlockBetweenUsers`,
   * testing.ts block-pair lookup) so the match service enforces the exact
   * same bidirectional block semantics chat uses — a blocker never receives
   * a contact request from a user they've blocked, and pre-block pending
   * rows never surface in the inbox after the block lands (F4-A Fix #1).
   */
  isBlockedBetween(userA: string, userB: string): Promise<boolean>;
  findContactRequestByPair(fromPostId: string, toPostId: string): Promise<ContactRequestRecord | null>;
  getContactRequest(contactRequestId: string): Promise<ContactRequestRecord | null>;
  saveContactRequest(record: ContactRequestRecord): Promise<ContactRequestRecord>;
  listInboxPage(input: {
    recipientUserId: string;
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<ContactRequestRecord>>;
  listInboxItems(input: {
    recipientUserId: string;
    cursor: string | null;
    limit?: number;
  }): Promise<CursorPage<ContactRequestInboxRow>>;
  getAcceptedConversationByContactRequest(
    contactRequestId: string,
  ): Promise<AcceptedConversationRecord | null>;
  getAcceptedConversation(conversationId: string): Promise<AcceptedConversationRecord | null>;
  saveAcceptedConversation(record: AcceptedConversationRecord): Promise<AcceptedConversationRecord>;
}

export interface MatchService {
  close(): Promise<void>;
  ensureInitialSuggestions(postId: string): Promise<void>;
  getSuggestions(input: GetSuggestionsInput): Promise<MatchResultsResponse>;
  createContactRequest(actor: MatchActor, request: MatchContactRequest): Promise<MatchContactResponse>;
  listInbox(input: ListInboxInput): Promise<ContactRequestInboxResponse>;
  acceptContactRequest(input: AcceptContactRequestInput): Promise<ContactRequestDecisionResponse>;
  rejectContactRequest(input: RejectContactRequestInput): Promise<ContactRequestDecisionResponse>;
  getAcceptedConversation(
    input: GetAcceptedConversationInput,
  ): Promise<AcceptedConversationRecord>;
}

export class MatchServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "forbidden"
      | "invalid_state"
      | "invalid_scope"
      | "invalid_cursor"
      | "verified_required"
      | "resource_fallback_unavailable",
  ) {
    super(message);
    this.name = "MatchServiceError";
  }
}
