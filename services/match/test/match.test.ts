import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createContactRequestRecord,
  createMatchService,
  createInMemoryMatchService,
  createMatchActor,
  createMatchablePost,
  createResourceSummary,
} from "../src/index.js";

describe("DefaultMatchService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a Top-3 batch with neighbor offers plus at least one official resource", async () => {
    const requestPost = createMatchablePost({
      post_id: "00000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries tonight",
      body: "Need help with dinner for two people.",
      language: "en",
      location_zip: "11735",
      created_by: "22222222-2222-4222-8222-222222222222",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offerA = createMatchablePost({
      post_id: "00000000-0000-4000-8000-000000000002",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can share pantry staples",
      body: "Rice, beans, and canned goods available.",
      language: "en",
      location_zip: "11735",
      created_by: "33333333-3333-4333-8333-333333333333",
      author_alias: "Neighbor A",
      author_level: "verified",
      anchor_reviewed: true,
      distance_miles: 0.8,
      expires_at: "2026-04-08T09:00:00.000Z",
    });
    const offerB = createMatchablePost({
      post_id: "00000000-0000-4000-8000-000000000003",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can share groceries tomorrow",
      body: "Pickup before noon.",
      language: "es",
      location_zip: "11735",
      created_by: "44444444-4444-4444-8444-444444444444",
      author_alias: "Neighbor B",
      author_level: "anonymous",
      distance_miles: 2.5,
      expires_at: "2026-04-08T18:00:00.000Z",
    });
    const resource = createResourceSummary({
      provider_id: "55555555-5555-4555-8555-555555555555",
      name: "Farmingdale Pantry",
      type: "pantry",
      address: "140 Main St, Farmingdale, NY 11735",
      zip: "11735",
      source: "cfc_active",
      directions_url: "https://maps.example/farmingdale",
      distance_miles: 0.4,
      is_open_today: true,
      is_open_now: true,
      languages: ["en", "es"],
    });
    const { service } = createInMemoryMatchService(
      {
        posts: [requestPost, offerA, offerB],
        resources: [resource],
      },
    );

    const actor = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    const result = await service.getSuggestions({
      actor,
      postId: requestPost.post_id,
    });

    expect(result.batch_number).toBe(1);
    expect(result.refreshes_used).toBe(0);
    expect(result.items).toHaveLength(3);
    expect(result.items.filter((item) => item.candidate_type === "neighbor_post")).toHaveLength(2);
    expect(result.items.filter((item) => item.candidate_type === "official_resource")).toHaveLength(1);
  });

  it("aligns freshness scoring with the expires_soon reason tag", async () => {
    const requestPost = createMatchablePost({
      post_id: "01000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries",
      body: "Need groceries tonight.",
      language: "en",
      location_zip: "11735",
      created_by: "01000000-0000-4000-8000-000000000002",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const expiringSoon = createMatchablePost({
      post_id: "01000000-0000-4000-8000-000000000003",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can help tonight",
      body: "Pickup available tonight.",
      language: "en",
      location_zip: "11735",
      created_by: "01000000-0000-4000-8000-000000000004",
      author_alias: "Neighbor A",
      author_level: "verified",
      distance_miles: 0.8,
      expires_at: "2026-04-08T00:00:00.000Z",
    });
    const laterExpiry = createMatchablePost({
      post_id: "01000000-0000-4000-8000-000000000005",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can help later this week",
      body: "Pickup later this week.",
      language: "en",
      location_zip: "11735",
      created_by: "01000000-0000-4000-8000-000000000006",
      author_alias: "Neighbor B",
      author_level: "verified",
      distance_miles: 0.8,
      expires_at: "2026-04-10T12:00:00.000Z",
    });
    const resource = createResourceSummary({
      provider_id: "01000000-0000-4000-8000-000000000007",
      name: "Pantry",
      type: "pantry",
      address: "140 Main St",
      zip: "11735",
      source: "cfc_active",
      directions_url: "https://maps.example/pantry",
      is_open_today: true,
    });
    const { service } = createInMemoryMatchService({
      posts: [requestPost, expiringSoon, laterExpiry],
      resources: [resource],
    });
    const actor = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    const result = await service.getSuggestions({ actor, postId: requestPost.post_id });
    const soonItem = result.items.find((item) => item.candidate_id === expiringSoon.post_id);
    const laterItem = result.items.find((item) => item.candidate_id === laterExpiry.post_id);

    expect(soonItem?.reasons).toContain("expires_soon");
    expect(laterItem?.reasons).not.toContain("expires_soon");
    expect((soonItem?.score ?? 0)).toBeGreaterThan(laterItem?.score ?? 0);
  });

  it("creates one refresh batch at most and excludes prior candidates", async () => {
    const requestPost = createMatchablePost({
      post_id: "10000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "goods",
      title: "Need a stroller",
      body: "Need one by tomorrow.",
      language: "en",
      location_zip: "11735",
      created_by: "20000000-0000-4000-8000-000000000001",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offers = [1, 2, 3].map((index) =>
      createMatchablePost({
        post_id: `10000000-0000-4000-8000-00000000000${index + 1}`,
        community_id: requestPost.community_id,
        post_type: "offer",
        category: "goods",
        title: `Offer ${index + 1}`,
        body: "Available now.",
        language: "en",
        location_zip: "11735",
        created_by: `30000000-0000-4000-8000-00000000000${index + 1}`,
        author_alias: `Neighbor ${index + 1}`,
        author_level: "verified",
        distance_miles: index + 0.2,
        expires_at: "2026-04-08T12:00:00.000Z",
      }),
    );
    const resources = [1, 2, 3].map((index) =>
      createResourceSummary({
        provider_id: `40000000-0000-4000-8000-00000000000${index}`,
        name: `Resource ${index}`,
        type: "pantry",
        address: `${index} Main St`,
        zip: "11735",
        source: "island_harvest",
        directions_url: `https://maps.example/${index}`,
        distance_miles: index,
      }),
    );
    const { service } = createInMemoryMatchService(
      {
        posts: [requestPost, ...offers],
        resources,
      },
    );
    const actor = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    const first = await service.getSuggestions({ actor, postId: requestPost.post_id });
    const second = await service.getSuggestions({ actor, postId: requestPost.post_id, refresh: true });
    const third = await service.getSuggestions({ actor, postId: requestPost.post_id, refresh: true });

    expect(first.batch_number).toBe(1);
    expect(second.batch_number).toBe(2);
    expect(second.advanced).toBe(true);
    expect(second.refreshes_used).toBe(1);
    const firstKeys = new Set(first.items.map((item) => `${item.candidate_type}:${item.candidate_id}`));
    const secondKeys = new Set(second.items.map((item) => `${item.candidate_type}:${item.candidate_id}`));
    const overlapping = [...firstKeys].filter((key) => secondKeys.has(key));
    expect(overlapping).toHaveLength(0);
    expect(third.batch_number).toBe(2);
    expect(third.advanced).toBe(false);
  });

  it("falls back to official resources only when no neighbor offers are available", async () => {
    const requestPost = createMatchablePost({
      post_id: "50000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "translation",
      title: "Need translation help",
      body: "Spanish interpretation for clinic visit.",
      language: "es",
      location_zip: "11735",
      created_by: "60000000-0000-4000-8000-000000000001",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const resources = [1, 2, 3].map((index) =>
      createResourceSummary({
        provider_id: `70000000-0000-4000-8000-00000000000${index}`,
        name: `Resource ${index}`,
        type: "benefits",
        address: `${index} Benefit Ave`,
        zip: "11735",
        source: "cfc_active",
        directions_url: `https://maps.example/benefit-${index}`,
        distance_miles: index,
        languages: ["es"],
        is_open_today: true,
      }),
    );
    const { service } = createInMemoryMatchService({
      posts: [requestPost],
      resources,
    });
    const actor = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    const result = await service.getSuggestions({ actor, postId: requestPost.post_id });

    expect(result.items).toHaveLength(3);
    expect(result.items.every((item) => item.candidate_type === "official_resource")).toBe(true);
  });

  it("fails closed when official resource fallback is unavailable", async () => {
    const requestPost = createMatchablePost({
      post_id: "51000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "goods",
      title: "Need baby supplies",
      body: "Need diapers and wipes.",
      language: "en",
      location_zip: "11735",
      created_by: "61000000-0000-4000-8000-000000000001",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offers = [1, 2, 3].map((index) =>
      createMatchablePost({
        post_id: `51000000-0000-4000-8000-00000000000${index + 1}`,
        community_id: requestPost.community_id,
        post_type: "offer",
        category: "goods",
        title: `Offer ${index}`,
        body: "Can help.",
        language: "en",
        location_zip: "11735",
        created_by: `62000000-0000-4000-8000-00000000000${index}`,
        author_alias: `Neighbor ${index}`,
        author_level: "verified",
        distance_miles: index,
        expires_at: "2026-04-08T12:00:00.000Z",
      }),
    );
    const { service } = createInMemoryMatchService({
      posts: [requestPost, ...offers],
      resources: [],
    });
    const actor = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    await expect(service.getSuggestions({ actor, postId: requestPost.post_id })).rejects.toMatchObject({
      code: "resource_fallback_unavailable",
    });
  });

  it("rewrites stored batches when score or reason tags change for the same candidates", async () => {
    const requestPost = createMatchablePost({
      post_id: "52000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries",
      body: "Need groceries tonight.",
      language: "en",
      location_zip: "11735",
      created_by: "52000000-0000-4000-8000-000000000009",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offer = createMatchablePost({
      post_id: "52000000-0000-4000-8000-000000000002",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can share groceries",
      body: "Pickup tonight.",
      language: "en",
      location_zip: "11735",
      created_by: "52000000-0000-4000-8000-000000000003",
      author_alias: "Neighbor",
      author_level: "anonymous",
      distance_miles: 0.8,
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const resource = createResourceSummary({
      provider_id: "52000000-0000-4000-8000-000000000004",
      name: "Pantry",
      type: "pantry",
      address: "140 Main St",
      zip: "11735",
      source: "cfc_active",
      directions_url: "https://maps.example/pantry",
      is_open_today: true,
    });
    const { service, repository } = createInMemoryMatchService({
      posts: [requestPost, offer],
      resources: [resource],
    });
    const actor = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    const first = await service.getSuggestions({ actor, postId: requestPost.post_id });
    const firstNeighbor = first.items.find((item) => item.candidate_type === "neighbor_post");
    expect(firstNeighbor?.candidate_id).toBe(offer.post_id);
    expect(firstNeighbor?.reasons).toContain("same_language");
    expect(firstNeighbor?.reasons).not.toContain("anchor_reviewed");

    repository.posts.set(
      offer.post_id,
      createMatchablePost({
        ...offer,
        language: "es",
        author_level: "anchor",
        anchor_reviewed: true,
        distance_miles: 4.2,
      }),
    );

    const second = await service.getSuggestions({ actor, postId: requestPost.post_id });
    const secondNeighbor = second.items.find((item) => item.candidate_type === "neighbor_post");
    expect(secondNeighbor?.candidate_id).toBe(offer.post_id);
    expect(secondNeighbor?.reasons).not.toContain("same_language");
    expect(secondNeighbor?.reasons).toContain("verified_user");
    expect(secondNeighbor?.reasons).toContain("anchor_reviewed");
    expect(secondNeighbor?.score).not.toBe(firstNeighbor?.score);
  });

  it("creates pending contact requests idempotently and upgrades to accepted with an accepted conversation record", async () => {
    const requestPost = createMatchablePost({
      post_id: "80000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries tonight",
      body: "Need groceries tonight.",
      language: "en",
      location_zip: "11735",
      created_by: "90000000-0000-4000-8000-000000000001",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offerPost = createMatchablePost({
      post_id: "80000000-0000-4000-8000-000000000002",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can share groceries",
      body: "Available after 6pm.",
      language: "en",
      location_zip: "11735",
      created_by: "90000000-0000-4000-8000-000000000002",
      author_alias: "Helper",
      author_level: "verified",
      anchor_reviewed: true,
      distance_miles: 0.5,
      expires_at: "2026-04-08T18:00:00.000Z",
    });
    const { service, repository } = createInMemoryMatchService(
      {
        posts: [requestPost, offerPost],
        resources: [
          createResourceSummary({
            provider_id: "80000000-0000-4000-8000-000000000010",
            name: "Resource",
            type: "pantry",
            address: "140 Main St",
            zip: "11735",
            source: "cfc_active",
            directions_url: "https://maps.example/resource",
          }),
        ],
      },
    );

    const requester = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });
    const recipient = createMatchActor({
      userId: offerPost.created_by,
      alias: "Helper",
      level: "verified",
      communityIds: [offerPost.community_id],
    });

    const first = await service.createContactRequest(requester, {
      from_post_id: requestPost.post_id,
      to_post_id: offerPost.post_id,
    });
    const second = await service.createContactRequest(requester, {
      from_post_id: requestPost.post_id,
      to_post_id: offerPost.post_id,
    });

    expect(first.status).toBe("pending");
    expect(second).toEqual(first);

    const pendingRecord = await repository.findContactRequestByPair(requestPost.post_id, offerPost.post_id);
    expect(pendingRecord).not.toBeNull();
    expect(
      new Date(pendingRecord!.expiresAt).getTime() - new Date(pendingRecord!.createdAt).getTime(),
    ).toBe(72 * 60 * 60 * 1000);

    const accepted = await service.acceptContactRequest({
      actor: recipient,
      contactRequestId: first.contact_request_id,
    });
    const acceptedAgain = await service.acceptContactRequest({
      actor: recipient,
      contactRequestId: first.contact_request_id,
    });

    expect(accepted.status).toBe("accepted");
    expect(accepted.conversation_id).toBeTruthy();
    // A3 P0-1: the first accept flags is_new_accept=true so the gateway
    // increments `verified_matches_total`. The second accept returns the
    // same conversation/payload but with is_new_accept=false so the
    // metric is not double-counted.
    expect(accepted.is_new_accept).toBe(true);
    expect(acceptedAgain.is_new_accept).toBe(false);
    expect({ ...acceptedAgain, is_new_accept: true }).toEqual(accepted);

    const replay = await service.createContactRequest(requester, {
      from_post_id: requestPost.post_id,
      to_post_id: offerPost.post_id,
    });
    expect(replay.status).toBe("accepted");
    expect(replay.conversation_id).toBe(accepted.conversation_id);

    const acceptedConversation = await service.getAcceptedConversation({
      actor: requester,
      conversationId: accepted.conversation_id!,
    });
    expect(acceptedConversation.contact_request_id).toBe(first.contact_request_id);
    expect(acceptedConversation.status).toBe("accepted_contact");
  });

  it("lists only pending inbox items and expires stale requests before surfacing them", async () => {
    const requestPost = createMatchablePost({
      post_id: "a0000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries",
      body: "Need groceries.",
      language: "en",
      location_zip: "11735",
      created_by: "a1000000-0000-4000-8000-000000000001",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offerPost = createMatchablePost({
      post_id: "a0000000-0000-4000-8000-000000000002",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can help",
      body: "Can help.",
      language: "en",
      location_zip: "11735",
      created_by: "a2000000-0000-4000-8000-000000000002",
      author_alias: "Helper",
      author_level: "verified",
      distance_miles: 1.2,
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const stale = createContactRequestRecord({
      contactRequestId: "a3000000-0000-4000-8000-000000000001",
      fromPostId: requestPost.post_id,
      toPostId: offerPost.post_id,
      requesterUserId: requestPost.created_by,
      recipientUserId: offerPost.created_by,
      requesterAlias: "Requester",
      createdAt: "2026-04-01T12:00:00.000Z",
      expiresAt: "2026-04-04T12:00:00.000Z",
    });
    const fresh = createContactRequestRecord({
      contactRequestId: "a3000000-0000-4000-8000-000000000002",
      fromPostId: requestPost.post_id,
      toPostId: offerPost.post_id,
      requesterUserId: requestPost.created_by,
      recipientUserId: offerPost.created_by,
      requesterAlias: "Requester",
      createdAt: "2026-04-07T11:00:00.000Z",
      expiresAt: "2026-04-10T11:00:00.000Z",
    });
    const { service } = createInMemoryMatchService(
      {
        posts: [requestPost, offerPost],
        contactRequests: [stale, fresh],
      },
    );
    const recipient = createMatchActor({
      userId: offerPost.created_by,
      alias: "Helper",
      level: "verified",
      communityIds: [offerPost.community_id],
    });

    const inbox = await service.listInbox({
      actor: recipient,
    });

    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]!.contact_request_id).toBe(fresh.contactRequestId);
  });

  it("keeps paging inbox until it finds a fresh pending request", async () => {
    const requestPost = createMatchablePost({
      post_id: "b0000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries",
      body: "Need groceries.",
      language: "en",
      location_zip: "11735",
      created_by: "b1000000-0000-4000-8000-000000000001",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offerPost = createMatchablePost({
      post_id: "b0000000-0000-4000-8000-000000000002",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can help",
      body: "Can help.",
      language: "en",
      location_zip: "11735",
      created_by: "b2000000-0000-4000-8000-000000000002",
      author_alias: "Helper",
      author_level: "verified",
      distance_miles: 1.2,
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const stale = Array.from({ length: 20 }, (_, index) =>
      createContactRequestRecord({
        contactRequestId: `b3000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`,
        fromPostId: requestPost.post_id,
        toPostId: offerPost.post_id,
        requesterUserId: requestPost.created_by,
        recipientUserId: offerPost.created_by,
        requesterAlias: "Requester",
        createdAt: `2026-04-07T${String(19 - index).padStart(2, "0")}:00:00.000Z`,
        expiresAt: "2026-04-04T12:00:00.000Z",
      }),
    );
    const fresh = createContactRequestRecord({
      contactRequestId: "b3999999-0000-4000-8000-000000000001",
      fromPostId: requestPost.post_id,
      toPostId: offerPost.post_id,
      requesterUserId: requestPost.created_by,
      recipientUserId: offerPost.created_by,
      requesterAlias: "Requester",
      createdAt: "2026-04-06T11:00:00.000Z",
      expiresAt: "2026-04-10T11:00:00.000Z",
    });
    const { service } = createInMemoryMatchService({
      posts: [requestPost, offerPost],
      contactRequests: [...stale, fresh],
    });
    const recipient = createMatchActor({
      userId: offerPost.created_by,
      alias: "Helper",
      level: "verified",
      communityIds: [offerPost.community_id],
    });

    const inbox = await service.listInbox({ actor: recipient, limit: 20 });

    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]!.contact_request_id).toBe(fresh.contactRequestId);
    expect(inbox.next_cursor).toBeNull();
  });

  it("only allows contact requests against neighbors in the current visible batch", async () => {
    const requestPost = createMatchablePost({
      post_id: "c0000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries",
      body: "Need groceries tonight.",
      language: "en",
      location_zip: "11735",
      created_by: "c1000000-0000-4000-8000-000000000001",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offers = [1, 2, 3].map((index) =>
      createMatchablePost({
        post_id: `c0000000-0000-4000-8000-00000000000${index + 1}`,
        community_id: requestPost.community_id,
        post_type: "offer",
        category: "food",
        title: `Offer ${index}`,
        body: "Can help.",
        language: "en",
        location_zip: "11735",
        created_by: `c2000000-0000-4000-8000-00000000000${index}`,
        author_alias: `Helper ${index}`,
        author_level: "verified",
        distance_miles: index,
        expires_at: "2026-04-08T12:00:00.000Z",
      }),
    );
    const resources = [1, 2, 3].map((index) =>
      createResourceSummary({
        provider_id: `c3000000-0000-4000-8000-00000000000${index}`,
        name: `Resource ${index}`,
        type: "pantry",
        address: `${index} Main St`,
        zip: "11735",
        source: "cfc_active",
        directions_url: `https://maps.example/${index}`,
        distance_miles: index,
      }),
    );
    const { service } = createInMemoryMatchService({
      posts: [requestPost, ...offers],
      resources,
    });
    const requester = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    const first = await service.getSuggestions({ actor: requester, postId: requestPost.post_id });
    const batchOneNeighbor = first.items.find((item) => item.candidate_type === "neighbor_post");
    expect(batchOneNeighbor).toBeTruthy();

    const second = await service.getSuggestions({
      actor: requester,
      postId: requestPost.post_id,
      refresh: true,
    });
    expect(second.batch_number).toBe(2);

    await expect(
      service.createContactRequest(requester, {
        from_post_id: requestPost.post_id,
        to_post_id: batchOneNeighbor!.candidate_id,
      }),
    ).rejects.toMatchObject({
      code: "invalid_scope",
    });
  });

  it("reuses an existing contact request even after refresh rotates that offer out of view", async () => {
    const requestPost = createMatchablePost({
      post_id: "d0000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries",
      body: "Need groceries tonight.",
      language: "en",
      location_zip: "11735",
      created_by: "d1000000-0000-4000-8000-000000000001",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offers = [1, 2, 3].map((index) =>
      createMatchablePost({
        post_id: `d0000000-0000-4000-8000-00000000000${index + 1}`,
        community_id: requestPost.community_id,
        post_type: "offer",
        category: "food",
        title: `Offer ${index}`,
        body: "Can help.",
        language: "en",
        location_zip: "11735",
        created_by: `d2000000-0000-4000-8000-00000000000${index}`,
        author_alias: `Helper ${index}`,
        author_level: "verified",
        distance_miles: index,
        expires_at: "2026-04-08T12:00:00.000Z",
      }),
    );
    const resources = [1, 2, 3].map((index) =>
      createResourceSummary({
        provider_id: `d3000000-0000-4000-8000-00000000000${index}`,
        name: `Resource ${index}`,
        type: "pantry",
        address: `${index} Main St`,
        zip: "11735",
        source: "cfc_active",
        directions_url: `https://maps.example/${index}`,
        distance_miles: index,
      }),
    );
    const { service } = createInMemoryMatchService({
      posts: [requestPost, ...offers],
      resources,
    });
    const requester = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    const first = await service.getSuggestions({ actor: requester, postId: requestPost.post_id });
    const batchOneNeighbor = first.items.find((item) => item.candidate_type === "neighbor_post");
    expect(batchOneNeighbor).toBeTruthy();

    const firstContact = await service.createContactRequest(requester, {
      from_post_id: requestPost.post_id,
      to_post_id: batchOneNeighbor!.candidate_id,
    });
    expect(firstContact.status).toBe("pending");

    const refreshed = await service.getSuggestions({
      actor: requester,
      postId: requestPost.post_id,
      refresh: true,
    });
    expect(refreshed.batch_number).toBe(2);
    expect(
      refreshed.items.some((item) => item.candidate_id === batchOneNeighbor!.candidate_id),
    ).toBe(false);

    const replayed = await service.createContactRequest(requester, {
      from_post_id: requestPost.post_id,
      to_post_id: batchOneNeighbor!.candidate_id,
    });
    expect(replayed).toEqual(firstContact);
  });

  it("treats expired pending contact requests as terminal and allows a fresh request", async () => {
    const requestPost = createMatchablePost({
      post_id: "e0000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries",
      body: "Need groceries tonight.",
      language: "en",
      location_zip: "11735",
      created_by: "e1000000-0000-4000-8000-000000000001",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offer = createMatchablePost({
      post_id: "e0000000-0000-4000-8000-000000000002",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can help",
      body: "Can help.",
      language: "en",
      location_zip: "11735",
      created_by: "e2000000-0000-4000-8000-000000000002",
      author_alias: "Helper",
      author_level: "verified",
      distance_miles: 0.8,
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const expiredPending = createContactRequestRecord({
      contactRequestId: "e3000000-0000-4000-8000-000000000001",
      fromPostId: requestPost.post_id,
      toPostId: offer.post_id,
      requesterUserId: requestPost.created_by,
      recipientUserId: offer.created_by,
      requesterAlias: "Requester",
      status: "pending",
      createdAt: "2026-04-01T12:00:00.000Z",
      expiresAt: "2026-04-04T12:00:00.000Z",
    });
    const { service, repository } = createInMemoryMatchService({
      posts: [
        requestPost,
        offer,
      ],
      resources: [
        createResourceSummary({
          provider_id: "e4000000-0000-4000-8000-000000000001",
          name: "Pantry",
          type: "pantry",
          address: "140 Main St",
          zip: "11735",
          source: "cfc_active",
          directions_url: "https://maps.example/pantry",
        }),
      ],
      contactRequests: [expiredPending],
    });
    const requester = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    const freshRequest = await service.createContactRequest(requester, {
      from_post_id: requestPost.post_id,
      to_post_id: offer.post_id,
    });

    expect(freshRequest.contact_request_id).not.toBe(expiredPending.contactRequestId);
    expect(freshRequest.status).toBe("pending");
    expect((await repository.getContactRequest(expiredPending.contactRequestId))?.status).toBe("expired");
  });

  it("returns accepted when the repository save path races and resolves to an accepted request", async () => {
    const requestPost = createMatchablePost({
      post_id: "e5000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries",
      body: "Need groceries tonight.",
      language: "en",
      location_zip: "11735",
      created_by: "e5000000-0000-4000-8000-000000000002",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offer = createMatchablePost({
      post_id: "e5000000-0000-4000-8000-000000000003",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can help",
      body: "Can help.",
      language: "en",
      location_zip: "11735",
      created_by: "e5000000-0000-4000-8000-000000000004",
      author_alias: "Helper",
      author_level: "verified",
      distance_miles: 0.8,
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const { repository } = createInMemoryMatchService({
      posts: [requestPost, offer],
      resources: [
        createResourceSummary({
          provider_id: "e5000000-0000-4000-8000-000000000005",
          name: "Pantry",
          type: "pantry",
          address: "140 Main St",
          zip: "11735",
          source: "cfc_active",
          directions_url: "https://maps.example/pantry",
        }),
      ],
    });
    const service = createMatchService(repository);
    repository.saveContactRequest = async (record) => ({
      ...record,
      status: "accepted",
      respondedAt: "2026-04-07T12:30:00.000Z",
    });
    repository.getAcceptedConversationByContactRequest = async () => ({
      conversation_id: "e5000000-0000-4000-8000-000000000006",
      contact_request_id: "e5000000-0000-4000-8000-000000000007",
      related_post_ids: [requestPost.post_id, offer.post_id],
      participant_preview: [
        { user_id: requestPost.created_by, alias: requestPost.author_alias },
        { user_id: offer.created_by, alias: offer.author_alias },
      ],
      status: "accepted_contact",
      created_at: "2026-04-07T12:30:00.000Z",
    });

    const requester = createMatchActor({
      userId: requestPost.created_by,
      alias: "Requester",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    const response = await service.createContactRequest(requester, {
      from_post_id: requestPost.post_id,
      to_post_id: offer.post_id,
    });

    expect(response.status).toBe("accepted");
    expect(response.conversation_id).toBe("e5000000-0000-4000-8000-000000000006");
  });

  it("does not mutate expired status when a non-recipient probes accept or reject", async () => {
    const requestPost = createMatchablePost({
      post_id: "f0000000-0000-4000-8000-000000000001",
      community_id: "11111111-1111-4111-8111-111111111111",
      post_type: "request",
      category: "food",
      title: "Need groceries",
      body: "Need groceries.",
      language: "en",
      location_zip: "11735",
      created_by: "f1000000-0000-4000-8000-000000000001",
      author_alias: "Requester",
      author_level: "verified",
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const offerPost = createMatchablePost({
      post_id: "f0000000-0000-4000-8000-000000000002",
      community_id: requestPost.community_id,
      post_type: "offer",
      category: "food",
      title: "Can help",
      body: "Can help.",
      language: "en",
      location_zip: "11735",
      created_by: "f2000000-0000-4000-8000-000000000002",
      author_alias: "Helper",
      author_level: "verified",
      distance_miles: 1.2,
      expires_at: "2026-04-08T12:00:00.000Z",
    });
    const expiredPending = createContactRequestRecord({
      contactRequestId: "f3000000-0000-4000-8000-000000000001",
      fromPostId: requestPost.post_id,
      toPostId: offerPost.post_id,
      requesterUserId: requestPost.created_by,
      recipientUserId: offerPost.created_by,
      requesterAlias: "Requester",
      createdAt: "2026-04-01T12:00:00.000Z",
      expiresAt: "2026-04-04T12:00:00.000Z",
    });
    const { service, repository } = createInMemoryMatchService({
      posts: [requestPost, offerPost],
      contactRequests: [expiredPending],
    });
    const stranger = createMatchActor({
      userId: "f4000000-0000-4000-8000-000000000001",
      alias: "Stranger",
      level: "verified",
      communityIds: [requestPost.community_id],
    });

    await expect(
      service.acceptContactRequest({
        actor: stranger,
        contactRequestId: expiredPending.contactRequestId,
      }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    expect((await repository.getContactRequest(expiredPending.contactRequestId))?.status).toBe("pending");

    await expect(
      service.rejectContactRequest({
        actor: stranger,
        contactRequestId: expiredPending.contactRequestId,
      }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    expect((await repository.getContactRequest(expiredPending.contactRequestId))?.status).toBe("pending");
  });

  // F4-A Fix #1: block enforcement on /v1/match/contact + /v1/contact-requests/inbox.
  // The match service must call `isBlockedBetween` — mirroring chat's
  // bidirectional `findBlockBetweenUsers` predicate — before persisting a
  // contact request, and must filter pre-block pending rows out of the
  // recipient's inbox so the blocker can't keep seeing the abuser.
  describe("block enforcement", () => {
    const blockRequestPostId = "e0000000-0000-4000-8000-000000000001";
    const blockOfferPostId = "e0000000-0000-4000-8000-000000000002";
    const blockCommunityId = "11111111-1111-4111-8111-111111111111";
    const blockRequesterUserId = "e1000000-0000-4000-8000-000000000001";
    const blockRecipientUserId = "e2000000-0000-4000-8000-000000000002";

    function buildBlockFixture() {
      const requestPost = createMatchablePost({
        post_id: blockRequestPostId,
        community_id: blockCommunityId,
        post_type: "request",
        category: "food",
        title: "Need groceries",
        body: "Need groceries.",
        language: "en",
        location_zip: "11735",
        created_by: blockRequesterUserId,
        author_alias: "Requester",
        author_level: "verified",
        expires_at: "2026-04-08T12:00:00.000Z",
      });
      const offerPost = createMatchablePost({
        post_id: blockOfferPostId,
        community_id: blockCommunityId,
        post_type: "offer",
        category: "food",
        title: "Can share groceries",
        body: "Available after 6pm.",
        language: "en",
        location_zip: "11735",
        created_by: blockRecipientUserId,
        author_alias: "Helper",
        author_level: "verified",
        anchor_reviewed: true,
        distance_miles: 0.5,
        expires_at: "2026-04-08T18:00:00.000Z",
      });
      const resource = createResourceSummary({
        provider_id: "e3000000-0000-4000-8000-000000000001",
        name: "Pantry",
        type: "pantry",
        address: "1 Main St",
        zip: "11735",
        source: "cfc_active",
        directions_url: "https://maps.example/resource",
      });
      return { requestPost, offerPost, resource };
    }

    it("rejects createContactRequest when the recipient has already blocked the requester", async () => {
      const { requestPost, offerPost, resource } = buildBlockFixture();
      const { service, repository } = createInMemoryMatchService({
        posts: [requestPost, offerPost],
        resources: [resource],
      });

      // Recipient blocked the requester before the contact request. The
      // match service should mirror chat's bidirectional predicate and
      // reject the insert with `forbidden` (mapped to HTTP 403 at the
      // gateway layer).
      repository.blocks.add(`${blockRecipientUserId}:${blockRequesterUserId}`);

      const requester = createMatchActor({
        userId: requestPost.created_by,
        alias: "Requester",
        level: "verified",
        communityIds: [requestPost.community_id],
      });

      await expect(
        service.createContactRequest(requester, {
          from_post_id: requestPost.post_id,
          to_post_id: offerPost.post_id,
        }),
      ).rejects.toMatchObject({
        code: "forbidden",
      });

      // Nothing persisted — the blocker never sees a pending row.
      const persisted = await repository.findContactRequestByPair(
        requestPost.post_id,
        offerPost.post_id,
      );
      expect(persisted).toBeNull();
    });

    it("rejects createContactRequest when the requester blocked the recipient (bidirectional)", async () => {
      const { requestPost, offerPost, resource } = buildBlockFixture();
      const { service, repository } = createInMemoryMatchService({
        posts: [requestPost, offerPost],
        resources: [resource],
      });

      // Requester blocked the recipient. Chat treats blocks as symmetric
      // (`findBlockBetweenUsers` checks both directions) — the match
      // service must too, otherwise the blocker could keep sending fresh
      // contact rows even though they can never receive a reply.
      repository.blocks.add(`${blockRequesterUserId}:${blockRecipientUserId}`);

      const requester = createMatchActor({
        userId: requestPost.created_by,
        alias: "Requester",
        level: "verified",
        communityIds: [requestPost.community_id],
      });

      await expect(
        service.createContactRequest(requester, {
          from_post_id: requestPost.post_id,
          to_post_id: offerPost.post_id,
        }),
      ).rejects.toMatchObject({
        code: "forbidden",
      });
    });

    it("hides pre-block pending rows from listInbox", async () => {
      const { requestPost, offerPost } = buildBlockFixture();
      const preBlockPending = createContactRequestRecord({
        contactRequestId: "e4000000-0000-4000-8000-000000000001",
        fromPostId: requestPost.post_id,
        toPostId: offerPost.post_id,
        requesterUserId: blockRequesterUserId,
        recipientUserId: blockRecipientUserId,
        requesterAlias: "Requester",
        createdAt: "2026-04-07T11:00:00.000Z",
        expiresAt: "2026-04-10T11:00:00.000Z",
      });
      const { service, repository } = createInMemoryMatchService({
        posts: [requestPost, offerPost],
        contactRequests: [preBlockPending],
      });

      // Inbox before block: the pending row is visible.
      const recipient = createMatchActor({
        userId: blockRecipientUserId,
        alias: "Helper",
        level: "verified",
        communityIds: [blockCommunityId],
      });

      const inboxBefore = await service.listInbox({ actor: recipient });
      expect(inboxBefore.items).toHaveLength(1);

      // Recipient then blocks the requester. The inbox must stop showing
      // the pre-block row — without this filter the blocker keeps re-seeing
      // the abuser's alias/metadata on every fetch (F4-A Fix #1).
      repository.blocks.add(`${blockRecipientUserId}:${blockRequesterUserId}`);

      const inboxAfter = await service.listInbox({ actor: recipient });
      expect(inboxAfter.items).toHaveLength(0);
    });
  });
});
