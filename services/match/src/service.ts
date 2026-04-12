import { randomUUID } from "node:crypto";

import { buildSuggestionBatch } from "./scoring.js";
import type {
  AcceptContactRequestInput,
  AcceptedConversationRecord,
  ContactRequestDecisionResponse,
  ContactRequestInboxResponse,
  GetAcceptedConversationInput,
  GetSuggestionsInput,
  MatchContactRequest,
  MatchContactResponse,
  MatchRepository,
  MatchResultsResponse,
  MatchService,
  MatchSuggestion,
  MatchSuggestionBatch,
  MatchablePost,
  RejectContactRequestInput,
  ResourceSummary,
} from "./types.js";
import { MatchServiceError } from "./types.js";

const CONTACT_REQUEST_TTL_HOURS = 72;
const MAX_REFRESHES = 1;

function candidateKey(input: { candidate_type: MatchSuggestion["candidate_type"]; candidate_id: string }) {
  return `${input.candidate_type}:${input.candidate_id}`;
}

function sameBatch(left: MatchSuggestionBatch | null, right: MatchSuggestionBatch | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right || left.items.length !== right.items.length) {
    return false;
  }

  return left.items.every((item, index) => {
    const other = right.items[index];
    if (!other) {
      return false;
    }
    return (
      item.position === other.position &&
      item.candidate_type === other.candidate_type &&
      item.candidate_id === other.candidate_id &&
      item.score === other.score &&
      item.reasons.length === other.reasons.length &&
      item.reasons.every((reason, reasonIndex) => reason === other.reasons[reasonIndex])
    );
  });
}

function getCurrentBatch(
  storedBatches: MatchSuggestionBatch[],
  batchOne: MatchSuggestionBatch,
) {
  return (
    storedBatches.find((batch) => batch.batchNumber === 2) ??
    storedBatches.find((batch) => batch.batchNumber === 1) ??
    batchOne
  );
}

function mapBatchForResponse(input: {
  batch: MatchSuggestionBatch;
  postId: string;
  refreshesUsed: number;
  advanced: boolean;
  neighbors: MatchablePost[];
  resources: ResourceSummary[];
}) {
  const neighborById = new Map(input.neighbors.map((item) => [item.post_id, item]));
  const resourceById = new Map(input.resources.map((item) => [item.provider_id, item]));

  return {
    post_id: input.postId,
    batch_number: input.batch.batchNumber,
    advanced: input.advanced,
    refreshes_used: input.refreshesUsed,
    max_refreshes: MAX_REFRESHES,
    items: input.batch.items
      .map((item) => {
        const neighbor = item.candidate_type === "neighbor_post" ? neighborById.get(item.candidate_id) : null;
        const resource = item.candidate_type === "official_resource" ? resourceById.get(item.candidate_id) : null;

        if (item.candidate_type === "neighbor_post" && !neighbor) {
          return null;
        }

        if (item.candidate_type === "official_resource" && !resource) {
          return null;
        }

        return {
          ...item,
          distance_miles: neighbor?.distance_miles ?? resource?.distance_miles ?? item.distance_miles,
          neighbor_post: neighbor
            ? {
                post_id: neighbor.post_id,
                community_id: neighbor.community_id,
                post_type: neighbor.post_type,
                category: neighbor.category,
                title: neighbor.title,
                body: neighbor.body,
                language: neighbor.language,
                location_zip: neighbor.location_zip,
                privacy: neighbor.privacy,
                status: neighbor.status,
                risk_level: neighbor.risk_level,
                created_at: neighbor.created_at,
                updated_at: neighbor.updated_at,
                expires_at: neighbor.expires_at,
                is_owner: false,
              }
            : null,
          official_resource: resource ?? null,
        };
      })
      .filter((item): item is MatchResultsResponse["items"][number] => Boolean(item)),
  } satisfies MatchResultsResponse;
}

export class DefaultMatchService implements MatchService {
  constructor(private readonly repository: MatchRepository) {}

  async close(): Promise<void> {
    await this.repository.close();
  }

  async ensureInitialSuggestions(postId: string): Promise<void> {
    const requestPost = await this.requireActiveRequest(postId);
    await this.syncSuggestionBatches(requestPost);
  }

  async getSuggestions(input: GetSuggestionsInput): Promise<MatchResultsResponse> {
    const requestPost = await this.requireActiveRequest(input.postId);
    if (requestPost.created_by !== input.actor.userId) {
      throw new MatchServiceError("Only the requester can view matches", "forbidden");
    }

    const { batchOne, batchTwo, neighbors, resources, stored } = await this.syncSuggestionBatches(requestPost);

    const existingBatchTwo = stored.find((batch) => batch.batchNumber === 2) ?? null;
    if (!input.refresh) {
      const chosenBatch = existingBatchTwo ?? batchOne;
      return mapBatchForResponse({
        batch: chosenBatch,
        postId: requestPost.post_id,
        refreshesUsed: existingBatchTwo ? 1 : 0,
        advanced: false,
        neighbors,
        resources,
      });
    }

    if (existingBatchTwo) {
      return mapBatchForResponse({
        batch: existingBatchTwo,
        postId: requestPost.post_id,
        refreshesUsed: 1,
        advanced: false,
        neighbors,
        resources,
      });
    }

    if (!batchTwo || batchTwo.items.length === 0) {
      return mapBatchForResponse({
        batch: batchOne,
        postId: requestPost.post_id,
        refreshesUsed: 0,
        advanced: false,
        neighbors,
        resources,
      });
    }

    await this.repository.saveSuggestionBatch(batchTwo);
    return mapBatchForResponse({
      batch: batchTwo,
      postId: requestPost.post_id,
      refreshesUsed: 1,
      advanced: true,
      neighbors,
      resources,
    });
  }

  async createContactRequest(actor: { userId: string; level: "anonymous" | "verified" | "anchor"; communityIds: string[] }, request: MatchContactRequest): Promise<MatchContactResponse> {
    if (actor.level === "anonymous") {
      throw new MatchServiceError("Verification is required before contacting a match", "verified_required");
    }

    const fromPost = await this.requireActiveRequest(request.from_post_id);
    if (fromPost.created_by !== actor.userId) {
      throw new MatchServiceError("Only the request owner can contact a match", "forbidden");
    }

    const existing = await this.repository.findContactRequestByPair(request.from_post_id, request.to_post_id);
    const normalizedExisting = existing ? await this.normalizeContactRequestRecord(existing) : null;
    if (normalizedExisting) {
      if (normalizedExisting.status === "pending") {
        return {
          contact_request_id: normalizedExisting.contactRequestId,
          status: "pending",
        };
      }

      if (normalizedExisting.status === "accepted") {
        const acceptedConversation = await this.repository.getAcceptedConversationByContactRequest(
          normalizedExisting.contactRequestId,
        );
        return {
          contact_request_id: normalizedExisting.contactRequestId,
          status: "accepted",
          conversation_id: acceptedConversation?.conversation_id,
        };
      }
    }

    const { batchOne, stored } = await this.syncSuggestionBatches(fromPost);
    const currentBatch = getCurrentBatch(stored, batchOne);
    const matchedOfferIds = new Set(
      currentBatch.items
        .filter((item) => item.candidate_type === "neighbor_post")
        .map((item) => item.candidate_id),
    );

    if (!matchedOfferIds.has(request.to_post_id)) {
      throw new MatchServiceError("This offer is not an eligible current match", "invalid_scope");
    }

    const toPost = await this.repository.getPost(request.to_post_id);
    if (!toPost || toPost.post_type !== "offer" || toPost.status !== "active") {
      throw new MatchServiceError("Matched offer is no longer available", "invalid_state");
    }

    if (toPost.created_by === actor.userId) {
      throw new MatchServiceError("You cannot contact your own post", "forbidden");
    }

    const created = await this.repository.saveContactRequest({
      contactRequestId: randomUUID(),
      fromPostId: fromPost.post_id,
      toPostId: toPost.post_id,
      requesterUserId: fromPost.created_by,
      recipientUserId: toPost.created_by,
      requesterAlias: fromPost.author_alias,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + CONTACT_REQUEST_TTL_HOURS * 60 * 60 * 1000).toISOString(),
      respondedAt: null,
    });

    if (created.status === "accepted") {
      const acceptedConversation = await this.repository.getAcceptedConversationByContactRequest(
        created.contactRequestId,
      );
      return {
        contact_request_id: created.contactRequestId,
        status: "accepted",
        conversation_id: acceptedConversation?.conversation_id,
      };
    }

    return {
      contact_request_id: created.contactRequestId,
      status: "pending",
    };
  }

  async listInbox(input: { actor: { userId: string; level: "anonymous" | "verified" | "anchor"; communityIds: string[] }; cursor?: string | null; limit?: number; }): Promise<ContactRequestInboxResponse> {
    if (input.actor.level === "anonymous") {
      throw new MatchServiceError("Verification is required before opening inbox", "verified_required");
    }

    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
    const freshItems = [];
    let cursor = input.cursor ?? null;
    let nextCursor: string | null = null;

    while (freshItems.length < limit) {
      const page = await this.repository.listInboxItems({
        recipientUserId: input.actor.userId,
        cursor,
        limit: limit - freshItems.length,
      });

      nextCursor = page.nextCursor;
      for (const item of page.items) {
        const normalized = await this.normalizeContactRequestRecord(item);
        if (normalized.status !== "pending") {
          continue;
        }
        freshItems.push(normalized);
      }

      if (!page.nextCursor) {
        nextCursor = null;
        break;
      }

      cursor = page.nextCursor;
    }

    return {
      items: freshItems.map((item) => ({
        contact_request_id: item.contactRequestId,
        from_post_id: item.fromPostId,
        to_post_id: item.toPostId,
        requester_user_id: item.requesterUserId,
        requester_alias: item.requesterAlias,
        status: item.status,
        created_at: item.createdAt,
        expires_at: item.expiresAt,
        from_post_title: item.fromPostTitle,
        to_post_title: item.toPostTitle,
        from_post_category: item.fromPostCategory,
        to_post_category: item.toPostCategory,
      })),
      next_cursor: nextCursor,
    };
  }

  async acceptContactRequest(input: AcceptContactRequestInput): Promise<ContactRequestDecisionResponse> {
    if (input.actor.level === "anonymous") {
      throw new MatchServiceError("Verification is required before accepting contact requests", "verified_required");
    }

    const contactRequest = await this.repository.getContactRequest(input.contactRequestId);
    if (!contactRequest) {
      throw new MatchServiceError("Contact request not found", "not_found");
    }

    if (contactRequest.recipientUserId !== input.actor.userId) {
      throw new MatchServiceError("Only the recipient can accept this request", "forbidden");
    }

    const normalizedRequest = await this.normalizeContactRequestRecord(contactRequest);

    if (
      normalizedRequest.status === "rejected" ||
      normalizedRequest.status === "expired" ||
      normalizedRequest.status === "cancelled"
    ) {
      throw new MatchServiceError("This request is no longer active", "invalid_state");
    }

    const existingConversation = await this.repository.getAcceptedConversationByContactRequest(
      normalizedRequest.contactRequestId,
    );
    if (normalizedRequest.status === "accepted" && existingConversation) {
      return {
        contact_request_id: normalizedRequest.contactRequestId,
        status: "accepted",
        responded_at: normalizedRequest.respondedAt ?? existingConversation.created_at,
        conversation_id: existingConversation.conversation_id,
      };
    }

    const respondedAt = new Date().toISOString();
    const updated = await this.repository.saveContactRequest({
      ...normalizedRequest,
      status: "accepted",
      respondedAt,
    });

    const requester = await this.repository.getPost(normalizedRequest.fromPostId);
    const recipient = await this.repository.getPost(normalizedRequest.toPostId);
    if (!requester || !recipient) {
      throw new MatchServiceError("Related posts are no longer available", "invalid_state");
    }

    const conversationId = existingConversation?.conversation_id ?? randomUUID();
    const acceptedConversation = await this.repository.saveAcceptedConversation({
      conversation_id: conversationId,
      contact_request_id: updated.contactRequestId,
      related_post_ids: [updated.fromPostId, updated.toPostId],
      participant_preview: [
        {
          user_id: updated.requesterUserId,
          alias: requester.author_alias,
        },
        {
          user_id: updated.recipientUserId,
          alias: recipient.author_alias,
        },
      ],
      status: "accepted_contact",
      created_at: existingConversation?.created_at ?? respondedAt,
    });

    return {
      contact_request_id: updated.contactRequestId,
      status: "accepted",
      responded_at: respondedAt,
      conversation_id: acceptedConversation.conversation_id,
    };
  }

  async rejectContactRequest(input: RejectContactRequestInput): Promise<ContactRequestDecisionResponse> {
    if (input.actor.level === "anonymous") {
      throw new MatchServiceError("Verification is required before rejecting contact requests", "verified_required");
    }

    const contactRequest = await this.repository.getContactRequest(input.contactRequestId);
    if (!contactRequest) {
      throw new MatchServiceError("Contact request not found", "not_found");
    }

    if (contactRequest.recipientUserId !== input.actor.userId) {
      throw new MatchServiceError("Only the recipient can reject this request", "forbidden");
    }

    const normalizedRequest = await this.normalizeContactRequestRecord(contactRequest);

    if (normalizedRequest.status === "accepted") {
      const acceptedConversation = await this.repository.getAcceptedConversationByContactRequest(
        normalizedRequest.contactRequestId,
      );
      return {
        contact_request_id: normalizedRequest.contactRequestId,
        status: "accepted",
        responded_at: normalizedRequest.respondedAt ?? acceptedConversation?.created_at ?? new Date().toISOString(),
        conversation_id: acceptedConversation?.conversation_id,
      };
    }

    if (normalizedRequest.status === "rejected") {
      return {
        contact_request_id: normalizedRequest.contactRequestId,
        status: "rejected",
        responded_at: normalizedRequest.respondedAt ?? new Date().toISOString(),
      };
    }

    if (normalizedRequest.status === "expired" || normalizedRequest.status === "cancelled") {
      throw new MatchServiceError("This request is no longer active", "invalid_state");
    }

    const respondedAt = new Date().toISOString();
    const updated = await this.repository.saveContactRequest({
      ...normalizedRequest,
      status: "rejected",
      respondedAt,
    });

    return {
      contact_request_id: updated.contactRequestId,
      status: "rejected",
      responded_at: respondedAt,
    };
  }

  async getAcceptedConversation(
    input: GetAcceptedConversationInput,
  ): Promise<AcceptedConversationRecord> {
    const acceptedConversation = await this.repository.getAcceptedConversation(input.conversationId);
    if (!acceptedConversation) {
      throw new MatchServiceError("Conversation not found", "not_found");
    }

    const isParticipant = acceptedConversation.participant_preview.some(
      (participant) => participant.user_id === input.actor.userId,
    );
    if (!isParticipant) {
      throw new MatchServiceError("Only participants can view this conversation", "forbidden");
    }

    return acceptedConversation;
  }

  private async requireActiveRequest(postId: string) {
    const post = await this.repository.getPost(postId);
    if (!post) {
      throw new MatchServiceError("Request post not found", "not_found");
    }

    if (post.post_type !== "request" || post.status !== "active") {
      throw new MatchServiceError("Matches are only available for active requests", "invalid_state");
    }

    if (new Date(post.expires_at).getTime() <= Date.now()) {
      throw new MatchServiceError("Matches are only available for active requests", "invalid_state");
    }

    return post;
  }

  private async syncSuggestionBatches(requestPost: MatchablePost) {
    const now = new Date();
    const neighbors = await this.repository.listCandidateNeighborPosts(requestPost);
    const resources = await this.repository.listOfficialResourcesForRequest(requestPost);
    if (resources.length === 0) {
      throw new MatchServiceError(
        "Official resource fallback is currently unavailable for this request",
        "resource_fallback_unavailable",
      );
    }

    const batchOne = buildSuggestionBatch({
      requestPost,
      batchNumber: 1,
      actorUserId: requestPost.created_by,
      neighbors,
      resources,
      now,
    });

    const batchTwo = this.buildSecondBatch(requestPost, neighbors, resources, batchOne, now);
    const stored = await this.repository.listSuggestionBatches(requestPost.post_id);
    const storedBatchOne = stored.find((batch) => batch.batchNumber === 1) ?? null;
    const storedBatchTwo = stored.find((batch) => batch.batchNumber === 2) ?? null;

    const shouldRewriteBatchOne = !sameBatch(storedBatchOne, batchOne);
    const shouldRewriteExistingBatchTwo = Boolean(storedBatchTwo && !sameBatch(storedBatchTwo, batchTwo));
    const shouldDeleteStaleBatchTwo = Boolean(storedBatchTwo && !batchTwo);

    if (shouldRewriteBatchOne || shouldRewriteExistingBatchTwo || shouldDeleteStaleBatchTwo) {
      await this.repository.deleteSuggestionBatches(requestPost.post_id);
      await this.repository.saveSuggestionBatch(batchOne);
      if (storedBatchTwo && batchTwo && batchTwo.items.length > 0) {
        await this.repository.saveSuggestionBatch(batchTwo);
      }
      return {
        batchOne,
        batchTwo,
        neighbors,
        resources,
        stored: await this.repository.listSuggestionBatches(requestPost.post_id),
      };
    }

    if (!storedBatchOne) {
      await this.repository.saveSuggestionBatch(batchOne);
      return {
        batchOne,
        batchTwo,
        neighbors,
        resources,
        stored: await this.repository.listSuggestionBatches(requestPost.post_id),
      };
    }

    return {
      batchOne,
      batchTwo,
      neighbors,
      resources,
      stored,
    };
  }

  private buildSecondBatch(
    requestPost: MatchablePost,
    neighbors: MatchablePost[],
    resources: ResourceSummary[],
    batchOne: MatchSuggestionBatch,
    now: Date,
  ) {
    const excludeCandidateKeys = new Set(
      batchOne.items.map((item) =>
        candidateKey({
          candidate_type: item.candidate_type,
          candidate_id: item.candidate_id,
        }),
      ),
    );

    const batchTwo = buildSuggestionBatch({
      requestPost,
      batchNumber: 2,
      actorUserId: requestPost.created_by,
      neighbors,
      resources,
      now,
      excludeCandidateKeys,
    });

    return batchTwo.items.length > 0 ? batchTwo : null;
  }

  private async normalizeContactRequestRecord<T extends {
    contactRequestId: string;
    status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
    expiresAt: string;
    respondedAt: string | null;
  }>(record: T): Promise<T> {
    if (record.status !== "pending" || new Date(record.expiresAt).getTime() > Date.now()) {
      return record;
    }

    const updated = await this.repository.saveContactRequest({
      ...(await this.repository.getContactRequest(record.contactRequestId))!,
      status: "expired",
      respondedAt: new Date().toISOString(),
    });

    return {
      ...record,
      status: "expired",
      respondedAt: updated.respondedAt,
    };
  }
}

export function createMatchService(repository: MatchRepository) {
  return new DefaultMatchService(repository);
}
