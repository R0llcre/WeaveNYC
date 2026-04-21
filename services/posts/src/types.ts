import type {
  AdminDashboardResponse,
  Announcement,
  AnnouncementCreateRequest,
  AnnouncementUpdateRequest,
  AnnouncementsResponse,
  CommunitySyncEvent,
  CommunityAccessEntry,
  CommunityAccessResolveResponse,
  CommunityRules,
  CommunitySummary,
  ContactPreference,
  CreatePostRequest,
  JoinCommunityResponse,
  MyPostsResponse,
  PostDetail,
  PostScope,
  PostStatus,
  PostsListResponse,
  ReviewDecision,
  ReviewDecisionResponse,
  ReviewQueueResponse,
  RiskLevel,
  UserLevel,
  UserRole,
} from '@weavenyc/shared';

export type PostActor = {
  userId: string;
  level: UserLevel;
  role: UserRole;
  communityIds: string[];
  anchorCommunityId?: string | null;
  mfaVerifiedAt?: string;
};

export type ResolveCommunityAccessInput = {
  userId: string;
  inviteCode?: string;
  qrToken?: string;
};

export type JoinCommunityInput = {
  userId: string;
  communityId: string;
};

export type CreatePostInput = {
  actor: PostActor;
  request: CreatePostRequest;
};

export type UpdatePostInput = {
  actor: PostActor;
  postId: string;
  request: Partial<Omit<CreatePostRequest, 'community_id' | 'post_type'>>;
};

export type ListPostsInput = {
  actor: PostActor;
  scope: PostScope;
  communityId?: string;
  postType?: CreatePostRequest['post_type'];
  category?: CreatePostRequest['category'];
  status?: PostStatus;
  cursor?: string | null;
  limit?: number;
};

export type ListMyPostsInput = {
  actor: PostActor;
  communityId?: string;
  status?: PostStatus;
  cursor?: string | null;
  limit?: number;
};

export type ReviewQueueInput = {
  actor: PostActor;
  communityId: string;
  cursor?: string | null;
  limit?: number;
};

export type ReviewDecisionInput = {
  actor: PostActor;
  postId: string;
  decision: ReviewDecision;
  notes?: string;
};

export type AdminDashboardInput = {
  actor: PostActor;
  communityId: string;
};

export type CommunityRulesInput = {
  actor: PostActor;
  communityId: string;
};

export type UpdateCommunityRulesInput = {
  actor: PostActor;
  communityId: string;
  rules: Omit<CommunityRules, "community_id" | "updated_at">;
};

export type ListAnnouncementsInput = {
  actor: PostActor | null;
  communityId: string;
  includeDeleted?: boolean;
};

export type CreateAnnouncementInput = {
  actor: PostActor;
  communityId: string;
  request: AnnouncementCreateRequest;
};

export type UpdateAnnouncementInput = {
  actor: PostActor;
  communityId: string;
  announcementId: string;
  request: AnnouncementUpdateRequest;
};

export type DeleteAnnouncementInput = {
  actor: PostActor;
  communityId: string;
  announcementId: string;
};

export type ResolvedCommunityAccess = CommunityAccessResolveResponse;

export type CommunityMembershipResult = JoinCommunityResponse;

export type CreatePostResult = {
  postId: string;
  status: PostStatus;
  riskLevel: RiskLevel;
  syncEvents?: CommunitySyncEvent[];
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type PostsService = {
  ping(): Promise<void>;
  close(): Promise<void>;
  resolveCommunityAccess(input: ResolveCommunityAccessInput): Promise<ResolvedCommunityAccess>;
  joinCommunity(input: JoinCommunityInput): Promise<CommunityMembershipResult>;
  createPost(input: CreatePostInput): Promise<CreatePostResult>;
  listPosts(input: ListPostsInput): Promise<PostsListResponse>;
  getPostDetail(actor: PostActor, postId: string): Promise<PostDetail>;
  updatePost(input: UpdatePostInput): Promise<SyncedPostDetail>;
  closePost(actor: PostActor, postId: string): Promise<SyncedPostDetail>;
  removePost(actor: PostActor, postId: string): Promise<SyncedPostDetail>;
  listMyPosts(input: ListMyPostsInput): Promise<MyPostsResponse>;
  listReviewQueue(input: ReviewQueueInput): Promise<ReviewQueueResponse>;
  decideReview(input: ReviewDecisionInput): Promise<
    ReviewDecisionResponse & {
      moderationActionId?: string | null;
      syncEvents?: CommunitySyncEvent[];
      alreadyDecided?: boolean;
    }
  >;
  getAdminDashboard(input: AdminDashboardInput): Promise<AdminDashboardResponse>;
  getCommunityRules(input: CommunityRulesInput): Promise<CommunityRules>;
  updateCommunityRules(input: UpdateCommunityRulesInput): Promise<CommunityRules>;
  listAnnouncements(input: ListAnnouncementsInput): Promise<AnnouncementsResponse>;
  createAnnouncement(input: CreateAnnouncementInput): Promise<SyncedAnnouncement>;
  updateAnnouncement(input: UpdateAnnouncementInput): Promise<SyncedAnnouncement>;
  deleteAnnouncement(input: DeleteAnnouncementInput): Promise<SyncedAnnouncement>;
};

export type CommunityRecord = CommunitySummary;

export type CommunityAccessCodeRecord = {
  community: CommunityRecord;
  entry: CommunityAccessEntry;
};

export type PostRecord = {
  postId: string;
  communityId: string;
  postType: CreatePostRequest['post_type'];
  category: CreatePostRequest['category'];
  title: string;
  body: string;
  language: CreatePostRequest['language'];
  locationZip: string;
  privacy: CreatePostRequest['privacy'];
  status: PostStatus;
  riskLevel: RiskLevel;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  contactPref: ContactPreference | null;
  p2pVersion?: number;
  ipfsCid?: string | null;
};

export type SyncedPostDetail = PostDetail & {
  p2p_version?: number;
  ipfs_cid?: string | null;
  syncEvents?: CommunitySyncEvent[];
};

export type SyncedAnnouncement = Announcement & {
  p2p_version?: number;
  ipfs_cid?: string | null;
  syncEvents?: CommunitySyncEvent[];
};

export class PostsServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not_found'
      | 'forbidden'
      | 'membership_required'
      | 'verified_required'
      | 'invalid_state'
      | 'invalid_input'
      | 'invalid_scope'
      | 'invalid_cursor'
  ) {
    super(message);
    this.name = 'PostsServiceError';
  }
}
