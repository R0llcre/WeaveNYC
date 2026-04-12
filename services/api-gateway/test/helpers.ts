import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { DefaultChatService, InMemoryChatRepository, type ChatService } from '@weavenyc/chat';
import { createMatchService, type MatchRepository, type MatchService } from '@weavenyc/match';
import { InMemoryPostsService } from '@weavenyc/posts';
import type { ResourceListItem, ResourceSearchInput, ResourceSearchResult } from '@weavenyc/resource-directory';

import type { AppConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { InMemoryChatRealtimeHub, type ChatRealtimeHub } from '../src/lib/chat-realtime.js';
import type { AuthAbuseStore } from '../src/lib/identity.js';
import type { RefreshTokenStore } from '../src/lib/refresh-token-store.js';
import type { ResourceDirectoryService } from '../src/lib/resource-directory.js';
import type { SpeechProvider } from '../src/lib/speech-providers.js';
import type { UserStore } from '../src/lib/user-store.js';
import type {
  AuthenticatedUserRecord,
  UserLevel,
  UserRole
} from '../src/types.js';
import type { StoredRefreshSession } from '../src/types.js';

function fallbackAlias(userId: string, displayName?: string | null) {
  return displayName?.trim() || `Neighbor ${userId.slice(-4)}`;
}

class InMemoryLinkedMatchRepository implements MatchRepository {
  readonly suggestionBatches = new Map<string, import('@weavenyc/match').MatchSuggestionBatch[]>();
  readonly contactRequests = new Map<string, import('@weavenyc/match').ContactRequestRecord>();
  readonly conversations = new Map<string, import('@weavenyc/match').AcceptedConversationRecord>();

  constructor(
    private readonly postsService: InMemoryPostsService,
    private readonly userStore: InMemoryUserStore,
    private readonly resourceDirectory: InMemoryResourceDirectory,
  ) {}

  async close(): Promise<void> {}

  async getPost(postId: string): Promise<import('@weavenyc/match').MatchablePost | null> {
    const post = this.postsService.posts.get(postId);
    if (!post) {
      return null;
    }

    const user = this.userStore.users.get(post.createdBy);
    return {
      post_id: post.postId,
      community_id: post.communityId,
      post_type: post.postType,
      category: post.category,
      title: post.title,
      body: post.body,
      language: post.language,
      location_zip: post.locationZip,
      privacy: post.privacy,
      status: post.status,
      risk_level: post.riskLevel,
      created_at: post.createdAt,
      updated_at: post.updatedAt,
      expires_at: post.expiresAt,
      is_owner: false,
      created_by: post.createdBy,
      author_alias: fallbackAlias(post.createdBy, undefined),
      author_level: user?.level ?? 'verified',
      anchor_reviewed: user?.role === 'anchor',
      distance_miles: post.locationZip === '11735' ? 0.4 : 1.8,
    } satisfies Awaited<ReturnType<InMemoryLinkedMatchRepository['getPost']>>;
  }

  async listCandidateNeighborPosts(requestPost: NonNullable<Awaited<ReturnType<InMemoryLinkedMatchRepository['getPost']>>>) {
    const posts = await Promise.all(
      Array.from(this.postsService.posts.keys()).map((postId) => this.getPost(postId)),
    );
    return posts.filter((post): post is NonNullable<typeof post> => {
      if (!post) {
        return false;
      }

      return (
        post.post_type === 'offer' &&
        post.community_id === requestPost.community_id &&
        post.category === requestPost.category &&
        post.created_by !== requestPost.created_by &&
        post.privacy !== 'anchor_mediated'
      );
    });
  }

  async listOfficialResourcesForRequest() {
    return this.resourceDirectory.items.map((item) => ({
      provider_id: item.providerId,
      name: item.name,
      type: item.type,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      phone: item.phone,
      languages: item.languages,
      source: item.source,
      source_label: item.sourceLabel,
      notes: item.notes,
      distance_miles: item.distanceMiles,
      is_open_today: item.isOpenToday,
      is_open_now: item.isOpenNow,
      geo_precision: item.geoPrecision,
      directions_url: `https://maps.google.com/?q=${encodeURIComponent(item.address)}`,
    }));
  }

  async listSuggestionBatches(requestPostId: string) {
    return (this.suggestionBatches.get(requestPostId) ?? []).map((batch) => ({
      ...batch,
      items: batch.items.map((item) => ({ ...item })),
    }));
  }

  async saveSuggestionBatch(batch: import('@weavenyc/match').MatchSuggestionBatch): Promise<void> {
    const existing = (this.suggestionBatches.get(batch.requestPostId) ?? []).filter(
      (entry) => entry.batchNumber !== batch.batchNumber,
    );
    existing.push({
      ...batch,
      items: batch.items.map((item) => ({ ...item })),
    });
    existing.sort((left, right) => left.batchNumber - right.batchNumber);
    this.suggestionBatches.set(batch.requestPostId, existing);
  }

  async deleteSuggestionBatches(requestPostId: string, batchNumbers?: number[]): Promise<void> {
    if (!batchNumbers?.length) {
      this.suggestionBatches.delete(requestPostId);
      return;
    }

    const existing = (this.suggestionBatches.get(requestPostId) ?? []).filter(
      (batch) => !batchNumbers.includes(batch.batchNumber),
    );
    this.suggestionBatches.set(requestPostId, existing);
  }

  async findContactRequestByPair(fromPostId: string, toPostId: string) {
    return (
      Array.from(this.contactRequests.values())
        .filter((record) => record.fromPostId === fromPostId && record.toPostId === toPostId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
    );
  }

  async getContactRequest(contactRequestId: string) {
    return this.contactRequests.get(contactRequestId) ?? null;
  }

  async saveContactRequest(record: import('@weavenyc/match').ContactRequestRecord) {
    this.contactRequests.set(record.contactRequestId, { ...record });
    return this.contactRequests.get(record.contactRequestId)!;
  }

  async listInboxPage(input: { recipientUserId: string; cursor: string | null; limit: number }) {
    const items = Array.from(this.contactRequests.values())
      .filter((item) => item.recipientUserId === input.recipientUserId && item.status === 'pending')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, input.limit);
    return {
      items,
      nextCursor: null,
    };
  }

  async listInboxItems(input: { recipientUserId: string; cursor: string | null; limit?: number }) {
    const page = await this.listInboxPage({
      recipientUserId: input.recipientUserId,
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: page.items.map((item) => {
        const fromPost = this.postsService.posts.get(item.fromPostId)!;
        const toPost = this.postsService.posts.get(item.toPostId)!;
        return {
          ...item,
          fromPostTitle: fromPost.title,
          toPostTitle: toPost.title,
          fromPostCategory: fromPost.category,
          toPostCategory: toPost.category,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  async getAcceptedConversationByContactRequest(contactRequestId: string) {
    return (
      Array.from(this.conversations.values()).find(
        (conversation) => conversation.contact_request_id === contactRequestId,
      ) ?? null
    );
  }

  async getAcceptedConversation(conversationId: string) {
    return this.conversations.get(conversationId) ?? null;
  }

  async saveAcceptedConversation(record: import('@weavenyc/match').AcceptedConversationRecord) {
    this.conversations.set(record.conversation_id, { ...record });
    return this.conversations.get(record.conversation_id)!;
  }

  async getPostCommunityId(postId: string) {
    return this.postsService.posts.get(postId)?.communityId ?? null;
  }
}

class InMemoryLinkedChatRepository extends InMemoryChatRepository {
  constructor(
    private readonly matchRepository: InMemoryLinkedMatchRepository,
    private readonly postsService: InMemoryPostsService,
  ) {
    super();
  }

  private syncConversations() {
    for (const placeholder of this.matchRepository.conversations.values()) {
      const contactRequest = this.matchRepository.contactRequests.get(placeholder.contact_request_id);
      if (!contactRequest) {
        continue;
      }

      const existing = this.conversations.get(placeholder.conversation_id);
      this.conversations.set(placeholder.conversation_id, {
        conversation_id: placeholder.conversation_id,
        contact_request_id: placeholder.contact_request_id,
        participant_user_ids: [contactRequest.requesterUserId, contactRequest.recipientUserId],
        participant_preview: [
          placeholder.participant_preview[0],
          placeholder.participant_preview[1],
        ],
        related_post_ids: placeholder.related_post_ids,
        status: existing?.status ?? 'active',
        created_at: placeholder.created_at,
        last_activity_at: existing?.last_activity_at ?? placeholder.created_at,
        closed_at: existing?.closed_at ?? null,
        blocked_at: existing?.blocked_at ?? null,
        blocked_by_user_id: existing?.blocked_by_user_id ?? null,
        last_message_preview: existing?.last_message_preview ?? null,
        last_message_at: existing?.last_message_at ?? null,
        unread_count: existing?.unread_count ?? 0,
      });
    }
  }

  override async listConversationsPage(input: { userId: string; cursor: string | null; limit: number }) {
    this.syncConversations();
    return super.listConversationsPage(input);
  }

  override async getConversation(conversationId: string, userId?: string | null) {
    this.syncConversations();
    return super.getConversation(conversationId, userId);
  }

  override async listMessagesPage(input: { conversationId: string; cursor: string | null; limit: number }) {
    this.syncConversations();
    return super.listMessagesPage(input);
  }

  override async saveMessage(input: {
    conversationId: string;
    senderUserId: string;
    body: string;
    safetyFlags: import('@weavenyc/chat').ChatMessage['safety_flags'];
    sentAt: string;
  }) {
    this.syncConversations();
    return super.saveMessage(input);
  }

  override async updateConversationState(input: {
    conversationId: string;
    status: import('@weavenyc/chat').ConversationRecord['status'];
    changedAt: string;
    blockedByUserId?: string | null;
  }) {
    this.syncConversations();
    return super.updateConversationState(input);
  }

  override async getPostCommunityId(postId: string) {
    return this.postsService.posts.get(postId)?.communityId ?? null;
  }

  override async getMessageContext(messageId: string) {
    this.syncConversations();
    const baseContext = await super.getMessageContext(messageId);
    if (!baseContext) {
      return null;
    }

    const conversation = this.conversations.get(baseContext.message.conversation_id);
    const communityId =
      this.postsService.posts.get(conversation?.related_post_ids[0] ?? '')?.communityId ?? baseContext.communityId;

    return {
      ...baseContext,
      communityId,
    };
  }
}

export class InMemoryUserStore implements UserStore {
  readonly users = new Map<string, AuthenticatedUserRecord>();
  readonly phoneIdentities = new Map<string, { hash: string; salt: string }>();
  readonly emailIdentities = new Map<string, { hash: string; salt: string }>();

  async ping(): Promise<void> {}

  async createAnonymousUser(deviceId: string): Promise<AuthenticatedUserRecord> {
    void deviceId;
    const user: AuthenticatedUserRecord = {
      userId: randomUUID(),
      level: 'anonymous',
      role: 'user',
      status: 'active',
      communityIds: []
    };

    this.users.set(user.userId, user);
    return user;
  }

  async getAuthUserById(userId: string): Promise<AuthenticatedUserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  async verifyUserPhone(
    userId: string,
    phoneHash: string,
    phoneHashSalt: string
  ): Promise<AuthenticatedUserRecord | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.level = 'verified';
    this.users.set(userId, user);
    this.phoneIdentities.set(userId, {
      hash: phoneHash,
      salt: phoneHashSalt
    });
    return user;
  }

  async verifyUserEmail(
    userId: string,
    emailHash: string,
    emailHashSalt: string
  ): Promise<AuthenticatedUserRecord | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.level = 'verified';
    this.users.set(userId, user);
    this.emailIdentities.set(userId, {
      hash: emailHash,
      salt: emailHashSalt
    });
    return user;
  }

  async close(): Promise<void> {}
}

export class InMemoryAuthAbuseStore implements AuthAbuseStore {
  readonly anonymousDecisions = new Map<string, { allowed: boolean; retryAfterSeconds: number; remaining: number }>();
  readonly refreshDecisions = new Map<string, { allowed: boolean; retryAfterSeconds: number; remaining: number }>();
  readonly otpDecisions = new Map<string, { allowed: boolean; retryAfterSeconds: number; remaining: number }>();
  readonly cooldowns = new Set<string>();
  readonly seenAnonymousKeys: string[] = [];
  readonly seenRefreshKeys: string[] = [];
  readonly seenOtpKeys: string[] = [];

  async checkAnonymousAuth(ipAddress: string) {
    this.seenAnonymousKeys.push(ipAddress);
    return this.anonymousDecisions.get(ipAddress) ?? {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 999
    };
  }

  async checkRefreshAttempt(userId: string) {
    this.seenRefreshKeys.push(userId);
    return this.refreshDecisions.get(userId) ?? {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 999
    };
  }

  async checkOtpStart(userId: string, phoneHash: string) {
    const key = `${userId}:${phoneHash}`;
    this.seenOtpKeys.push(key);
    if (this.cooldowns.has(phoneHash)) {
      return {
        allowed: false,
        retryAfterSeconds: 3600,
        remaining: 0
      };
    }

    return this.otpDecisions.get(key) ?? {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 999
    };
  }

  async activateOtpCooldown(phoneHash: string) {
    this.cooldowns.add(phoneHash);
  }

  async close(): Promise<void> {}
}

export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  readonly sessions = new Map<string, StoredRefreshSession>();
  readonly revokedFamilies = new Set<string>();
  readonly usedTokens = new Map<string, { familyId: string; userId: string }>();
  readonly challenges = new Map<string, {
    challengeId: string;
    kind: 'otp' | 'magic_link';
    userId: string;
    identityHash: string;
    identitySalt: string;
    abuseHash: string | null;
    maskedDestination: string;
    codeOrToken: string;
    attemptsRemaining: number;
    expiresAt: number;
  }>();

  async ping(): Promise<void> {}

  async createSession(token: string, session: StoredRefreshSession): Promise<void> {
    this.sessions.set(token, session);
  }

  async inspectSession(token: string) {
    const session = this.sessions.get(token);
    if (session) {
      if (this.revokedFamilies.has(session.familyId)) {
        return {
          status: 'revoked' as const,
          familyId: session.familyId,
          userId: session.userId
        };
      }

      return {
        status: 'active' as const,
        session
      };
    }

    const replay = this.usedTokens.get(token);
    if (replay) {
      return {
        status: 'replayed' as const,
        familyId: replay.familyId,
        userId: replay.userId
      };
    }

    return {
      status: 'missing' as const
    };
  }

  async rotateSession(currentToken: string, nextToken: string) {
    const session = this.sessions.get(currentToken);
    if (!session) {
      const replay = this.usedTokens.get(currentToken);
      if (replay) {
        this.revokedFamilies.add(replay.familyId);
        return {
          status: 'replayed' as const,
          familyId: replay.familyId,
          userId: replay.userId
        };
      }

      return {
        status: 'missing' as const
      };
    }

    if (this.revokedFamilies.has(session.familyId)) {
      this.sessions.delete(currentToken);
      return {
        status: 'revoked' as const,
        familyId: session.familyId,
        userId: session.userId
      };
    }

    this.sessions.delete(currentToken);
    this.usedTokens.set(currentToken, {
      familyId: session.familyId,
      userId: session.userId
    });
    this.sessions.set(nextToken, session);

    return {
      status: 'rotated' as const,
      session
    };
  }

  async revokeUserSessions(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        this.revokedFamilies.add(session.familyId);
      }
    }
  }

  async createOtpChallenge(challenge: {
    challengeId: string;
    kind: 'otp';
    userId: string;
    identityHash: string;
    identitySalt: string;
    abuseHash: string | null;
    maskedDestination: string;
    codeOrToken: string;
    attemptsRemaining: number;
    expiresAt: number;
  }): Promise<void> {
    this.challenges.set(`otp:${challenge.challengeId}`, challenge);
  }

  async createMagicLinkChallenge(challenge: {
    challengeId: string;
    kind: 'magic_link';
    userId: string;
    identityHash: string;
    identitySalt: string;
    abuseHash: string | null;
    maskedDestination: string;
    codeOrToken: string;
    attemptsRemaining: number;
    expiresAt: number;
  }): Promise<void> {
    this.challenges.set(`magic_link:${challenge.challengeId}`, challenge);
  }

  async verifyChallenge(input: {
    challengeId: string;
    kind: 'otp' | 'magic_link';
    codeOrToken: string;
  }) {
    const key = `${input.kind}:${input.challengeId}`;
    const challenge = this.challenges.get(key);
    if (!challenge) {
      return { status: 'missing' as const };
    }

    if (challenge.expiresAt <= Date.now()) {
      this.challenges.delete(key);
      return { status: 'expired' as const };
    }

    if (challenge.codeOrToken !== input.codeOrToken) {
      challenge.attemptsRemaining -= 1;
      if (challenge.attemptsRemaining <= 0) {
        this.challenges.delete(key);
        return { status: 'exhausted' as const, challenge };
      }
      return { status: 'invalid' as const };
    }

    this.challenges.delete(key);
    return {
      status: 'verified' as const,
      challenge
    };
  }

  async close(): Promise<void> {}
}

export class InMemoryResourceDirectory implements ResourceDirectoryService {
  constructor(
    readonly items: ResourceListItem[] = [
      {
        providerId: '77777777-7777-4777-8777-777777777777',
        name: "St. Kilian's Social Ministry",
        type: 'pantry',
        address: '140 Elizabeth St., Farmingdale, NY 11735',
        city: 'Farmingdale',
        state: 'NY',
        zip: '11735',
        phone: '5167569656',
        languages: ['en', 'es'],
        source: 'island_harvest',
        sourceLabel: 'Island Harvest Pantry Finder',
        sourceUrl: 'https://storerocket.io/api/user/n0pjnLgp6V/locations',
        notes: 'Official pantry listing.',
        distanceMiles: 0.15,
        isOpenToday: true,
        isOpenNow: false,
        geoPrecision: 'street',
        weeklyHours: [
          { day: 'mon', windows: [{ opensAt: '09:00AM', closesAt: '12:00PM' }], closed: false },
          { day: 'tue', windows: [{ opensAt: '09:00AM', closesAt: '12:00PM' }], closed: false },
          { day: 'wed', windows: [{ opensAt: '09:00AM', closesAt: '12:00PM' }], closed: false },
          { day: 'thu', windows: [{ opensAt: '09:00AM', closesAt: '12:00PM' }], closed: false },
          { day: 'fri', windows: [], closed: true },
          { day: 'sat', windows: [], closed: true },
          { day: 'sun', windows: [], closed: true }
        ]
      },
      {
        providerId: '88888888-8888-4888-8888-888888888888',
        name: 'Hope for the Future',
        type: 'pantry',
        address: '131 Verdi Street, Farmingdale, NY 11735',
        city: 'Farmingdale',
        state: 'NY',
        zip: '11735',
        phone: '(631)752-5771',
        languages: ['en'],
        source: 'island_harvest',
        sourceLabel: 'Island Harvest Pantry Finder',
        sourceUrl: 'https://storerocket.io/api/user/n0pjnLgp6V/locations',
        notes: 'Official pantry listing.',
        distanceMiles: 1.99,
        isOpenToday: true,
        isOpenNow: false,
        geoPrecision: 'street',
        weeklyHours: [
          { day: 'mon', windows: [], closed: true },
          { day: 'tue', windows: [], closed: true },
          { day: 'wed', windows: [], closed: true },
          { day: 'thu', windows: [{ opensAt: '04:00PM', closesAt: '06:00PM' }], closed: false },
          { day: 'fri', windows: [], closed: true },
          { day: 'sat', windows: [], closed: true },
          { day: 'sun', windows: [], closed: true }
        ]
      },
      {
        providerId: '99999999-9999-4999-8999-999999999999',
        name: 'St. Martin of Tours - Bethpage',
        type: 'pantry',
        address: '208 Broadway, Bethpage, NY 11714',
        city: 'Bethpage',
        state: 'NY',
        zip: '11714',
        phone: '(516)931-7332',
        languages: ['en'],
        source: 'island_harvest',
        sourceLabel: 'Island Harvest Pantry Finder',
        sourceUrl: 'https://storerocket.io/api/user/n0pjnLgp6V/locations',
        notes: 'Nearby pantry.',
        distanceMiles: 1.81,
        isOpenToday: true,
        isOpenNow: false,
        geoPrecision: 'street',
        weeklyHours: [
          { day: 'mon', windows: [], closed: true },
          { day: 'tue', windows: [{ opensAt: '10:00AM', closesAt: '01:00PM' }], closed: false },
          { day: 'wed', windows: [], closed: true },
          { day: 'thu', windows: [{ opensAt: '10:00AM', closesAt: '01:00PM' }], closed: false },
          { day: 'fri', windows: [], closed: true },
          { day: 'sat', windows: [], closed: true },
          { day: 'sun', windows: [], closed: true }
        ]
      }
    ]
  ) {}

  async searchResources(input: ResourceSearchInput): Promise<ResourceSearchResult> {
    const filtered = this.items.filter((item) => {
      if (input.type && item.type !== input.type) {
        return false;
      }

      if (input.today && !item.isOpenToday) {
        return false;
      }

      if (input.openNow && !item.isOpenNow) {
        return false;
      }

      return true;
    });

    return {
      items: filtered.slice(0, input.limit ?? 20),
      nextCursor: null,
      sourceMode: 'fixture'
    };
  }

  async getResourceDetail(providerId: string): Promise<ResourceListItem | null> {
    return this.items.find((item) => item.providerId === providerId) ?? null;
  }

  async close(): Promise<void> {}
}

export class InMemorySpeechProvider implements SpeechProvider {
  async transcribe(input: {
    audio: Buffer;
    languageHint?: 'en' | 'es' | 'zh';
    transcriptHint?: string;
  }) {
    const transcript = (input.transcriptHint ?? input.audio.toString('utf8')) || 'demo transcript';
    return {
      transcript,
      language: input.languageHint ?? 'en',
      provider: 'server_fallback' as const
    };
  }

  async close(): Promise<void> {}
}

export function createTestConfig(): AppConfig {
  return {
    env: 'test',
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 4000
    },
    databaseUrl: 'postgres://test:test@127.0.0.1:5432/test',
    redisUrl: 'redis://127.0.0.1:6379',
    pwaBaseUrl: 'http://localhost:3000',
    jwt: {
      issuer: 'weavenyc-api-gateway-test',
      accessTokenTtl: '15m',
      privateKeyPath: '',
      publicKeyPath: '',
      privateKey: readFileSync(resolve(import.meta.dirname, '../../../infra/dev/jwt-private.pem'), 'utf8'),
      publicKey: readFileSync(resolve(import.meta.dirname, '../../../infra/dev/jwt-public.pem'), 'utf8')
    },
    refreshTokenTtlSeconds: 60 * 60 * 24 * 7,
    identityHashPepper: 'test-identity-pepper'
  };
}

export async function createTestApp(options: {
  authAbuseStore?: AuthAbuseStore;
  chatRealtimeHub?: ChatRealtimeHub;
  chatRepository?: InMemoryChatRepository;
  chatService?: ChatService;
  config?: AppConfig;
  matchService?: MatchService;
  postsService?: InMemoryPostsService;
  userStore?: UserStore;
  refreshTokenStore?: RefreshTokenStore;
  resourceDirectory?: ResourceDirectoryService;
  speechProvider?: SpeechProvider;
} = {}) {
  const authAbuseStore = options.authAbuseStore ?? new InMemoryAuthAbuseStore();
  const postsService = options.postsService ?? new InMemoryPostsService();
  const userStore = options.userStore ?? new InMemoryUserStore();
  const refreshTokenStore = options.refreshTokenStore ?? new InMemoryRefreshTokenStore();
  const resourceDirectory = options.resourceDirectory ?? new InMemoryResourceDirectory();
  const speechProvider = options.speechProvider ?? new InMemorySpeechProvider();
  const linkedMatchRepository =
    options.matchService
      ? null
      : new InMemoryLinkedMatchRepository(
          postsService,
          userStore as InMemoryUserStore,
          resourceDirectory as InMemoryResourceDirectory,
        );
  const chatRepository = options.chatRepository ?? (linkedMatchRepository ? new InMemoryLinkedChatRepository(linkedMatchRepository, postsService as InMemoryPostsService) : new InMemoryChatRepository());
  const chatService = options.chatService ?? new DefaultChatService(chatRepository);
  const chatRealtimeHub = options.chatRealtimeHub ?? new InMemoryChatRealtimeHub();
  const matchService =
    options.matchService ??
    createMatchService(
      linkedMatchRepository!,
    );

  const app = await buildApp({
    authAbuseStore,
    chatRealtimeHub,
    chatService,
    config: options.config ?? createTestConfig(),
    matchService,
    postsService,
    userStore,
    refreshTokenStore,
    resourceDirectory,
    speechProvider,
    logger: false
  });

  return {
    app,
    authAbuseStore,
    chatRealtimeHub,
    chatService,
    chatRepository,
    matchService,
    postsService,
    userStore,
    refreshTokenStore,
    resourceDirectory,
    speechProvider
  };
}

export function createUserRecord(input: {
  userId?: string;
  level?: UserLevel;
  role?: UserRole;
  communityIds?: string[];
} = {}): AuthenticatedUserRecord {
  return {
    userId: input.userId ?? randomUUID(),
    level: input.level ?? 'anonymous',
    role: input.role ?? 'user',
    status: 'active',
    communityIds: input.communityIds ?? []
  };
}
