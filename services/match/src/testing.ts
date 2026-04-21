import { randomUUID } from "node:crypto";

import { createMatchService } from "./service.js";
import type {
  AcceptedConversationRecord,
  ContactRequestInboxRow,
  ContactRequestRecord,
  CursorPage,
  MatchActor,
  MatchRepository,
  MatchSuggestionBatch,
  MatchablePost,
  ResourceSummary,
} from "./types.js";

function fallbackAlias(userId: string, alias: string | undefined) {
  return alias?.trim() || `Neighbor ${userId.slice(-4)}`;
}

function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt?: string;
      id?: string;
    };
    if (!parsed.createdAt || !parsed.id) {
      throw new Error("invalid");
    }
    return parsed as { createdAt: string; id: string };
  } catch {
    throw new Error("Invalid cursor");
  }
}

function encodeCursor(createdAt: string, id: string) {
  return Buffer.from(JSON.stringify({ createdAt, id }), "utf8").toString("base64url");
}

export class InMemoryMatchRepository implements MatchRepository {
  readonly posts = new Map<string, MatchablePost>();
  readonly resources = new Map<string, ResourceSummary>();
  readonly suggestionBatches = new Map<string, MatchSuggestionBatch[]>();
  readonly contactRequests = new Map<string, ContactRequestRecord>();
  readonly conversations = new Map<string, AcceptedConversationRecord>();
  /**
   * Test-time mirror of the chat service's `blocks` table. Keyed by the
   * ordered pair `blocker:blocked` so tests can simulate a unilateral block
   * (F4-A Fix #1). Bidirectional lookup in `isBlockedBetween` keeps the
   * semantics identical to chat's `findBlockBetweenUsers`.
   */
  readonly blocks = new Set<string>();

  async close(): Promise<void> {}

  async getPost(postId: string): Promise<MatchablePost | null> {
    return this.posts.get(postId) ?? null;
  }

  async listCandidateNeighborPosts(requestPost: MatchablePost): Promise<MatchablePost[]> {
    return Array.from(this.posts.values()).filter(
      (post) =>
        post.post_type === "offer" &&
        post.community_id === requestPost.community_id &&
        post.category === requestPost.category &&
        post.created_by !== requestPost.created_by &&
        post.privacy !== "anchor_mediated",
    );
  }

  async listOfficialResourcesForRequest(): Promise<ResourceSummary[]> {
    return Array.from(this.resources.values());
  }

  async listSuggestionBatches(requestPostId: string): Promise<MatchSuggestionBatch[]> {
    return (this.suggestionBatches.get(requestPostId) ?? []).map((batch) => ({
      ...batch,
      items: batch.items.map((item) => ({ ...item })),
    }));
  }

  async saveSuggestionBatch(batch: MatchSuggestionBatch): Promise<void> {
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

  async isBlockedBetween(userA: string, userB: string): Promise<boolean> {
    return this.blocks.has(`${userA}:${userB}`) || this.blocks.has(`${userB}:${userA}`);
  }

  async findContactRequestByPair(fromPostId: string, toPostId: string): Promise<ContactRequestRecord | null> {
    return (
      Array.from(this.contactRequests.values())
        .filter((record) => record.fromPostId === fromPostId && record.toPostId === toPostId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
    );
  }

  async getContactRequest(contactRequestId: string): Promise<ContactRequestRecord | null> {
    return this.contactRequests.get(contactRequestId) ?? null;
  }

  async saveContactRequest(record: ContactRequestRecord): Promise<ContactRequestRecord> {
    this.contactRequests.set(record.contactRequestId, { ...record });
    return this.contactRequests.get(record.contactRequestId)!;
  }

  async listInboxPage(input: {
    recipientUserId: string;
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<ContactRequestRecord>> {
    const cursor = decodeCursor(input.cursor);
    const limit = Math.min(Math.max(input.limit, 1), 50);
    const items = Array.from(this.contactRequests.values())
      .filter((item) => item.recipientUserId === input.recipientUserId && item.status === "pending")
      .sort((left, right) => {
        if (left.createdAt === right.createdAt) {
          return right.contactRequestId.localeCompare(left.contactRequestId);
        }
        return right.createdAt.localeCompare(left.createdAt);
      })
      .filter((item) => {
        if (!cursor) {
          return true;
        }
        if (item.createdAt < cursor.createdAt) {
          return true;
        }
        if (item.createdAt > cursor.createdAt) {
          return false;
        }
        return item.contactRequestId < cursor.id;
      });

    const pageItems = items.slice(0, limit);
    const last = pageItems.at(-1);
    return {
      items: pageItems,
      nextCursor:
        items.length > limit && last ? encodeCursor(last.createdAt, last.contactRequestId) : null,
    };
  }

  async listInboxItems(input: {
    recipientUserId: string;
    cursor: string | null;
    limit?: number;
  }): Promise<CursorPage<ContactRequestInboxRow>> {
    const page = await this.listInboxPage({
      recipientUserId: input.recipientUserId,
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: page.items.map((item) => {
        const fromPost = this.posts.get(item.fromPostId)!;
        const toPost = this.posts.get(item.toPostId)!;
        return {
          ...item,
          requesterAlias: fallbackAlias(item.requesterUserId, item.requesterAlias),
          fromPostTitle: fromPost.title,
          toPostTitle: toPost.title,
          fromPostCategory: fromPost.category,
          toPostCategory: toPost.category,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  async getAcceptedConversationByContactRequest(
    contactRequestId: string,
  ): Promise<AcceptedConversationRecord | null> {
    return (
      Array.from(this.conversations.values()).find(
        (conversation) => conversation.contact_request_id === contactRequestId,
      ) ?? null
    );
  }

  async getAcceptedConversation(conversationId: string): Promise<AcceptedConversationRecord | null> {
    return this.conversations.get(conversationId) ?? null;
  }

  async saveAcceptedConversation(record: AcceptedConversationRecord): Promise<AcceptedConversationRecord> {
    this.conversations.set(record.conversation_id, { ...record });
    return this.conversations.get(record.conversation_id)!;
  }
}

export function createMatchablePost(
  input: Partial<MatchablePost> &
    Pick<
      MatchablePost,
      | "post_id"
      | "community_id"
      | "post_type"
      | "category"
      | "title"
      | "body"
      | "language"
      | "location_zip"
      | "created_by"
    >,
): MatchablePost {
  const now = new Date("2026-04-07T12:00:00.000Z").toISOString();
  return {
    post_id: input.post_id,
    community_id: input.community_id,
    post_type: input.post_type,
    category: input.category,
    title: input.title,
    body: input.body,
    language: input.language,
    location_zip: input.location_zip,
    privacy: input.privacy ?? "community_only",
    status: input.status ?? "active",
    risk_level: input.risk_level ?? "low",
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
    expires_at: input.expires_at ?? new Date("2026-04-08T12:00:00.000Z").toISOString(),
    is_owner: false,
    created_by: input.created_by,
    author_alias: input.author_alias ?? fallbackAlias(input.created_by, undefined),
    author_level: input.author_level ?? "verified",
    anchor_reviewed: input.anchor_reviewed ?? false,
    distance_miles: input.distance_miles ?? null,
  };
}

export function createResourceSummary(
  input: Partial<ResourceSummary> &
    Pick<ResourceSummary, "provider_id" | "name" | "type" | "address" | "zip" | "source" | "directions_url">,
): ResourceSummary {
  return {
    provider_id: input.provider_id,
    name: input.name,
    type: input.type,
    address: input.address,
    city: input.city ?? null,
    state: input.state ?? null,
    zip: input.zip,
    phone: input.phone ?? null,
    languages: input.languages ?? ["en"],
    source: input.source,
    source_label: input.source_label ?? input.source,
    notes: input.notes ?? null,
    distance_miles: input.distance_miles ?? null,
    is_open_today: input.is_open_today ?? false,
    is_open_now: input.is_open_now ?? false,
    geo_precision: input.geo_precision ?? "street",
    directions_url: input.directions_url,
  };
}

export function createContactRequestRecord(
  input: Partial<ContactRequestRecord> &
    Pick<ContactRequestRecord, "fromPostId" | "toPostId" | "requesterUserId" | "recipientUserId">,
): ContactRequestRecord {
  return {
    contactRequestId: input.contactRequestId ?? randomUUID(),
    fromPostId: input.fromPostId,
    toPostId: input.toPostId,
    requesterUserId: input.requesterUserId,
    recipientUserId: input.recipientUserId,
    requesterAlias: input.requesterAlias ?? fallbackAlias(input.requesterUserId, undefined),
    status: input.status ?? "pending",
    createdAt: input.createdAt ?? new Date("2026-04-07T12:00:00.000Z").toISOString(),
    expiresAt: input.expiresAt ?? new Date("2026-04-10T12:00:00.000Z").toISOString(),
    respondedAt: input.respondedAt ?? null,
  };
}

export function createMatchActor(input: Partial<MatchActor> & Pick<MatchActor, "userId">): MatchActor {
  return {
    userId: input.userId,
    level: input.level ?? "verified",
    alias: input.alias ?? fallbackAlias(input.userId, undefined),
    communityIds: input.communityIds ?? [],
  };
}

export function createDefaultInMemoryMatchRepository() {
  const repository = new InMemoryMatchRepository();
  const requestPost = createMatchablePost({
    post_id: "88888888-8888-4888-8888-888888888888",
    community_id: "44444444-4444-4444-8444-444444444444",
    post_type: "request",
    category: "food",
    title: "Need groceries tonight",
    body: "Looking for food support for dinner.",
    language: "en",
    location_zip: "11735",
    created_by: "22222222-2222-4222-8222-222222222222",
    author_alias: "Verified Demo User",
  });
  const offerA = createMatchablePost({
    post_id: "99999999-9999-4999-8999-999999999999",
    community_id: requestPost.community_id,
    post_type: "offer",
    category: "food",
    title: "Can share groceries",
    body: "Extra groceries available this evening.",
    language: "en",
    location_zip: "11735",
    created_by: "33333333-3333-4333-8333-333333333333",
    author_alias: "Anchor Demo User",
    author_level: "anchor",
    anchor_reviewed: true,
    distance_miles: 0.4,
  });
  const offerB = createMatchablePost({
    post_id: randomUUID(),
    community_id: requestPost.community_id,
    post_type: "offer",
    category: "food",
    title: "Food pantry pickup available",
    body: "Can help pick up food boxes.",
    language: "en",
    location_zip: "11735",
    created_by: "44444444-1111-4333-8333-333333333333",
    author_alias: "Verified Neighbor",
    author_level: "verified",
    distance_miles: 1.8,
  });

  repository.posts.set(requestPost.post_id, requestPost);
  repository.posts.set(offerA.post_id, offerA);
  repository.posts.set(offerB.post_id, offerB);

  const resource = createResourceSummary({
    provider_id: "77777777-7777-4777-8777-777777777777",
    name: "St. Kilian Parish Social Ministry",
    type: "pantry",
    address: "140 Elizabeth Street, Farmingdale, NY 11735",
    zip: "11735",
    source: "cfc_active",
    source_label: "NYC HRA Community Food Connection",
    directions_url: "https://maps.google.com/?q=140+Elizabeth+Street+Farmingdale+NY+11735",
    distance_miles: 0.2,
    is_open_today: true,
    languages: ["en", "es"],
  });
  repository.resources.set(resource.provider_id, resource);

  return repository;
}

export function createInMemoryMatchService(
  seed?: {
    posts?: MatchablePost[];
    resources?: ResourceSummary[];
    contactRequests?: ContactRequestRecord[];
    conversations?: AcceptedConversationRecord[];
  },
) {
  const repository = new InMemoryMatchRepository();
  for (const post of seed?.posts ?? Array.from(createDefaultInMemoryMatchRepository().posts.values())) {
    repository.posts.set(post.post_id, post);
  }
  for (const resource of seed?.resources ?? Array.from(createDefaultInMemoryMatchRepository().resources.values())) {
    repository.resources.set(resource.provider_id, resource);
  }
  for (const contactRequest of seed?.contactRequests ?? []) {
    repository.contactRequests.set(contactRequest.contactRequestId, contactRequest);
  }
  for (const conversation of seed?.conversations ?? []) {
    repository.conversations.set(conversation.conversation_id, conversation);
  }

  return {
    repository,
    service: createMatchService(repository),
  };
}
