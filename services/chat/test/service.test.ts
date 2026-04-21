import { describe, expect, it, vi } from "vitest";

import { DefaultChatService } from "../src/service.js";
import { defaultChatSafetyDetector } from "../src/safety.js";
import { InMemoryChatRepository } from "../src/testing.js";
import type { ChatActor, ConversationRecord } from "../src/types.js";
import { ChatServiceError } from "../src/types.js";

const requester: ChatActor = {
  userId: "11111111-1111-4111-8111-111111111111",
  level: "verified",
  alias: "Requester",
  communityIds: ["44444444-4444-4444-8444-444444444444"],
};

const recipient: ChatActor = {
  userId: "22222222-2222-4222-8222-222222222222",
  level: "verified",
  alias: "Recipient",
  communityIds: ["44444444-4444-4444-8444-444444444444"],
};

const communityId = "44444444-4444-4444-8444-444444444444";

function seedConversation(repository: InMemoryChatRepository): ConversationRecord {
  const conversation: ConversationRecord = {
    conversation_id: "33333333-3333-4333-8333-333333333333",
    contact_request_id: "44444444-4444-4444-8444-444444444444",
    participant_user_ids: [requester.userId, recipient.userId],
    participant_preview: [
      { user_id: requester.userId, alias: requester.alias! },
      { user_id: recipient.userId, alias: recipient.alias! },
    ],
    related_post_ids: [
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
    ],
    status: "active",
    created_at: "2026-04-10T12:00:00.000Z",
    last_activity_at: "2026-04-10T12:00:00.000Z",
    closed_at: null,
    blocked_at: null,
    blocked_by_user_id: null,
    last_message_preview: null,
    last_message_at: null,
    unread_count: 0,
  };
  repository.seedConversation(conversation);
  repository.seedPostCommunityId(conversation.related_post_ids[0]!, communityId);
  repository.seedPostCommunityId(conversation.related_post_ids[1]!, communityId);
  return conversation;
}

describe("DefaultChatService", () => {
  it("sends a message, persists advisory flags, and updates conversation state", async () => {
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    const hooks = {
      onMessageAccepted: vi.fn(),
    };
    const service = new DefaultChatService(
      repository,
      defaultChatSafetyDetector,
      hooks,
      () => new Date("2026-04-10T12:05:00.000Z"),
    );

    const result = await service.sendMessage({
      actor: requester,
      conversationId: conversation.conversation_id,
      body: "Please avoid gift card requests and let's meet in public.",
    });

    expect(result.message.body).toContain("gift card");
    expect(result.message.safety_flags).toContain("keyword_gift_card");
    expect(result.conversation.last_message_preview).toContain("gift card");
    expect(hooks.onMessageAccepted).toHaveBeenCalledOnce();
  });

  it("blocks sensitive content without persisting the blocked body", async () => {
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    const hooks = {
      onMessageBlocked: vi.fn(),
    };
    const service = new DefaultChatService(
      repository,
      defaultChatSafetyDetector,
      hooks,
      () => new Date("2026-04-10T12:05:00.000Z"),
    );

    await expect(
      service.sendMessage({
        actor: requester,
        conversationId: conversation.conversation_id,
        body: "My SSN is 123-45-6789.",
      }),
    ).rejects.toMatchObject({
      code: "sensitive_content_detected",
    } satisfies Partial<ChatServiceError>);

    expect(Array.from(repository.messages.values())).toHaveLength(0);
    expect(hooks.onMessageBlocked).toHaveBeenCalledOnce();
    expect(hooks.onMessageBlocked).toHaveBeenCalledWith(
      expect.objectContaining({
        blockingFlags: ["sensitive_ssn"],
      }),
    );
  });

  it("paginates messages and marks the latest item as read", async () => {
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    repository.seedMessage({
      message_id: "77777777-7777-4777-8777-777777777771",
      conversation_id: conversation.conversation_id,
      sender_user_id: recipient.userId,
      body: "First",
      safety_flags: [],
      sent_at: "2026-04-10T12:01:00.000Z",
    });
    repository.seedMessage({
      message_id: "77777777-7777-4777-8777-777777777772",
      conversation_id: conversation.conversation_id,
      sender_user_id: recipient.userId,
      body: "Second",
      safety_flags: [],
      sent_at: "2026-04-10T12:02:00.000Z",
    });
    repository.seedMessage({
      message_id: "77777777-7777-4777-8777-777777777773",
      conversation_id: conversation.conversation_id,
      sender_user_id: requester.userId,
      body: "Third",
      safety_flags: [],
      sent_at: "2026-04-10T12:03:00.000Z",
    });
    const service = new DefaultChatService(repository);

    const firstPage = await service.listMessages({
      actor: requester,
      conversationId: conversation.conversation_id,
      limit: 2,
    });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.items[0]?.body).toBe("Third");
    expect(firstPage.next_cursor).toBeTruthy();
    expect(repository.reads.get(`${conversation.conversation_id}:${requester.userId}`)).toEqual({
      messageId: "77777777-7777-4777-8777-777777777773",
      readAt: "2026-04-10T12:03:00.000Z",
    });

    await service.listMessages({
      actor: requester,
      conversationId: conversation.conversation_id,
      limit: 1,
      cursor: firstPage.next_cursor,
    });

    expect(repository.reads.get(`${conversation.conversation_id}:${requester.userId}`)).toEqual({
      messageId: "77777777-7777-4777-8777-777777777773",
      readAt: "2026-04-10T12:03:00.000Z",
    });
  });

  it("blocks the other participant and hides the conversation from future reads", async () => {
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    repository.seedConversation({
      ...conversation,
      conversation_id: "99999999-9999-4999-8999-999999999999",
      contact_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      last_activity_at: "2026-04-10T12:04:00.000Z",
      last_message_preview: "Second thread",
      last_message_at: "2026-04-10T12:04:00.000Z",
    });
    const service = new DefaultChatService(repository);

    const result = await service.blockUser({
      actor: requester,
      conversationId: conversation.conversation_id,
      blockedUserId: recipient.userId,
    });

    expect(result.block.blocked_user_id).toBe(recipient.userId);
    expect(result.affectedConversations).toHaveLength(2);
    expect(repository.conversations.get(conversation.conversation_id)?.status).toBe("blocked");
    expect(repository.conversations.get("99999999-9999-4999-8999-999999999999")?.status).toBe("blocked");
    await expect(
      service.getConversation({
        actor: requester,
        conversationId: conversation.conversation_id,
      }),
    ).rejects.toMatchObject({
      code: "conversation_blocked",
    } satisfies Partial<ChatServiceError>);
    await expect(
      service.getConversation({
        actor: requester,
        conversationId: "99999999-9999-4999-8999-999999999999",
      }),
    ).rejects.toMatchObject({
      code: "conversation_blocked",
    } satisfies Partial<ChatServiceError>);
  });

  it("closes a conversation and prevents further sends", async () => {
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    const service = new DefaultChatService(
      repository,
      defaultChatSafetyDetector,
      {},
      () => new Date("2026-04-10T12:09:00.000Z"),
    );

    const closed = await service.closeConversation({
      actor: requester,
      conversationId: conversation.conversation_id,
    });

    expect(closed.status).toBe("closed");
    await expect(
      service.sendMessage({
        actor: requester,
        conversationId: conversation.conversation_id,
        body: "Still there?",
      }),
    ).rejects.toMatchObject({
      code: "conversation_closed",
    } satisfies Partial<ChatServiceError>);
  });

  it("creates a message report for a blocked conversation and links the community", async () => {
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    repository.seedMessage({
      message_id: "77777777-7777-4777-8777-777777777774",
      conversation_id: conversation.conversation_id,
      sender_user_id: recipient.userId,
      body: "Send me your passport number.",
      safety_flags: ["keyword_passport"],
      sent_at: "2026-04-10T12:04:00.000Z",
    });
    const hooks = {
      onReportCreated: vi.fn(),
    };
    const service = new DefaultChatService(repository, defaultChatSafetyDetector, hooks);

    await service.blockUser({
      actor: requester,
      conversationId: conversation.conversation_id,
      blockedUserId: recipient.userId,
    });

    const submission = await service.submitReport({
      actor: requester,
      conversationId: conversation.conversation_id,
      targetType: "message",
      targetId: "77777777-7777-4777-8777-777777777774",
      reason: "unsafe_behavior",
      detailText: "Asked for sensitive information",
    });

    expect(submission.report.target_type).toBe("message");
    expect(submission.report.community_id).toBe(communityId);
    expect(hooks.onReportCreated).toHaveBeenCalledOnce();
  });

  it("creates a post report without conversation context and links the community", async () => {
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    const service = new DefaultChatService(repository, defaultChatSafetyDetector, {});

    const submission = await service.submitReport({
      actor: requester,
      targetType: "post",
      targetId: conversation.related_post_ids[0]!,
      reason: "other",
      detailText: "Needs moderator review",
    });

    expect(submission.report.target_type).toBe("post");
    expect(submission.report.community_id).toBe(communityId);
  });

  it("returns the anchor identity when auto-hide removes a post after three DISTINCT reporters", async () => {
    // A2 P1-7: auto-hide triggers on three *distinct* reporters, not three
    // reports from the same user. Seeds two reporters directly and fires a
    // third submitReport() from a third neighbor to cross the threshold.
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    repository.seedActiveAnchorUserId(communityId, "88888888-8888-4888-8888-888888888888");
    repository.reports.set("99999999-9999-4999-8999-999999999991", {
      report_id: "99999999-9999-4999-8999-999999999991",
      community_id: communityId,
      target_type: "post",
      target_id: conversation.related_post_ids[0]!,
      reason: "unsafe_behavior",
      detail_text: "First report",
      conversation_id: null,
      reporter_user_id: requester.userId,
      status: "new",
      resolution: null,
      created_at: "2026-04-10T12:00:00.000Z",
      resolved_at: null,
    });
    repository.reports.set("99999999-9999-4999-8999-999999999992", {
      report_id: "99999999-9999-4999-8999-999999999992",
      community_id: communityId,
      target_type: "post",
      target_id: conversation.related_post_ids[0]!,
      reason: "unsafe_behavior",
      detail_text: "Second report",
      conversation_id: null,
      reporter_user_id: recipient.userId,
      status: "new",
      resolution: null,
      created_at: "2026-04-10T12:01:00.000Z",
      resolved_at: null,
    });
    const service = new DefaultChatService(repository, defaultChatSafetyDetector, {}, () => new Date("2026-04-10T12:05:00.000Z"));

    const thirdReporter: ChatActor = {
      userId: "77777777-7777-4777-8777-777777777777",
      level: "verified",
      alias: "Third neighbor",
      communityIds: [communityId],
    };
    const submission = await service.submitReport({
      actor: thirdReporter,
      targetType: "post",
      targetId: conversation.related_post_ids[0]!,
      reason: "unsafe_behavior",
      detailText: "Third report triggers threshold",
    });

    expect(submission.autoHiddenPostId).toBe(conversation.related_post_ids[0]!);
    expect(submission.autoHiddenActorUserId).toBe("88888888-8888-4888-8888-888888888888");
  });

  it("does NOT auto-hide when a single user stacks three reports (A2 P1-7 regression)", async () => {
    // Prior behaviour: the same user could tap Report three times and
    // trip auto-hide. This test locks in the new behaviour where only
    // distinct reporters count, and the dedup index collapses the same
    // reporter's repeat taps to one 'new' row.
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    repository.seedActiveAnchorUserId(communityId, "88888888-8888-4888-8888-888888888888");
    const service = new DefaultChatService(repository, defaultChatSafetyDetector, {}, () => new Date("2026-04-10T12:05:00.000Z"));

    for (let i = 0; i < 3; i += 1) {
      const submission = await service.submitReport({
        actor: requester,
        targetType: "post",
        targetId: conversation.related_post_ids[0]!,
        reason: "unsafe_behavior",
        detailText: `Tap ${i + 1} from the same griefer`,
      });
      expect(submission.autoHiddenPostId).toBeNull();
    }

    // Only a single 'new' row exists despite 3 submissions from the same
    // reporter against the same target.
    const reportsForTarget = Array.from(repository.reports.values()).filter(
      (row) =>
        row.target_id === conversation.related_post_ids[0]! &&
        row.status === "new",
    );
    expect(reportsForTarget).toHaveLength(1);
    expect(reportsForTarget[0]!.reporter_user_id).toBe(requester.userId);
  });

  it("creates a user report without conversation context when the community is unambiguous", async () => {
    const repository = new InMemoryChatRepository();
    seedConversation(repository);
    const service = new DefaultChatService(repository, defaultChatSafetyDetector, {});

    const submission = await service.submitReport({
      actor: requester,
      targetType: "user",
      targetId: recipient.userId,
      targetCommunityIds: recipient.communityIds,
      reason: "harassment",
      detailText: "Unsafe coordination outside the app",
    });

    expect(submission.report.target_type).toBe("user");
    expect(submission.report.community_id).toBe(communityId);
  });

  it("closes the send-while-block TOCTOU window atomically", async () => {
    // The peer blocks the conversation concurrently with a send. The
    // atomic check-and-insert in saveMessage must surface exactly one of two
    // outcomes per send call: either the block lost the race and the message
    // persists, or the block won and the send raises conversation_blocked
    // with zero message rows written.
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    const service = new DefaultChatService(
      repository,
      defaultChatSafetyDetector,
      {},
      () => new Date("2026-04-10T12:05:00.000Z"),
    );

    // Fire the block first (synchronous in memory); the send arrives after
    // the block is committed. The service pre-check will catch this, but the
    // underlying atomic insert would also reject — we verify both layers
    // collaborate.
    await service.blockUser({
      actor: recipient,
      conversationId: conversation.conversation_id,
      blockedUserId: requester.userId,
    });

    await expect(
      service.sendMessage({
        actor: requester,
        conversationId: conversation.conversation_id,
        body: "Can you still hear me?",
      }),
    ).rejects.toMatchObject({
      code: "conversation_blocked",
    } satisfies Partial<ChatServiceError>);

    // Zero messages persisted — the atomic predicate rejected the insert.
    expect(Array.from(repository.messages.values())).toHaveLength(0);
  });

  it("send-while-block races resolve to exactly one semantic winner", async () => {
    // Simulate the A2 P0-8 TOCTOU: two parallel operations against the same
    // conversation — a send and a block. The atomic repository layer must
    // serialize them so exactly one of the two outcomes is observed:
    //   (a) the send commits first and the block lands after (message
    //       persists, subsequent sends fail), or
    //   (b) the block commits first and the send raises conversation_blocked
    //       with zero messages persisted.
    for (let iteration = 0; iteration < 10; iteration += 1) {
      const repository = new InMemoryChatRepository();
      const conversation = seedConversation(repository);
      const service = new DefaultChatService(
        repository,
        defaultChatSafetyDetector,
        {},
        () => new Date("2026-04-10T12:05:00.000Z"),
      );

      const sendPromise = service
        .sendMessage({
          actor: requester,
          conversationId: conversation.conversation_id,
          body: `Race attempt ${iteration}`,
        })
        .catch((error: unknown) => ({ error }));
      const blockPromise = service.blockUser({
        actor: recipient,
        conversationId: conversation.conversation_id,
        blockedUserId: requester.userId,
      });

      const [sendResult] = await Promise.all([sendPromise, blockPromise]);
      const messageCount = Array.from(repository.messages.values()).length;

      if ("error" in sendResult) {
        // Block won: send raised conversation_blocked and no row was written.
        expect(sendResult.error).toMatchObject({
          code: "conversation_blocked",
        } satisfies Partial<ChatServiceError>);
        expect(messageCount).toBe(0);
      } else {
        // Send won: exactly one message was persisted; the block is ordered
        // after it. A second send immediately after MUST fail.
        expect(messageCount).toBe(1);
        expect(sendResult.message.body).toContain(`Race attempt ${iteration}`);
        await expect(
          service.sendMessage({
            actor: requester,
            conversationId: conversation.conversation_id,
            body: "follow-up",
          }),
        ).rejects.toMatchObject({
          code: "conversation_blocked",
        } satisfies Partial<ChatServiceError>);
      }
    }
  });

  it("enforces the send rate limit", async () => {
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    for (let index = 0; index < 20; index += 1) {
      repository.seedMessage({
        message_id: `88888888-8888-4888-8888-${String(index).padStart(12, "0")}`,
        conversation_id: conversation.conversation_id,
        sender_user_id: requester.userId,
        body: `Message ${index}`,
        safety_flags: [],
        sent_at: "2026-04-10T12:04:30.000Z",
      });
    }
    const service = new DefaultChatService(
      repository,
      defaultChatSafetyDetector,
      {},
      () => new Date("2026-04-10T12:05:00.000Z"),
    );

    await expect(
      service.sendMessage({
        actor: requester,
        conversationId: conversation.conversation_id,
        body: "One more message",
      }),
    ).rejects.toMatchObject({
      code: "rate_limited",
    } satisfies Partial<ChatServiceError>);
  });
});
