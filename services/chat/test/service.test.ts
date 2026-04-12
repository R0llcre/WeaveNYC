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

    const report = await service.submitReport({
      actor: requester,
      conversationId: conversation.conversation_id,
      targetType: "message",
      targetId: "77777777-7777-4777-8777-777777777774",
      reason: "unsafe_behavior",
      detailText: "Asked for sensitive information",
    });

    expect(report.target_type).toBe("message");
    expect(report.community_id).toBe(communityId);
    expect(hooks.onReportCreated).toHaveBeenCalledOnce();
  });

  it("creates a post report without conversation context and links the community", async () => {
    const repository = new InMemoryChatRepository();
    const conversation = seedConversation(repository);
    const service = new DefaultChatService(repository, defaultChatSafetyDetector, {});

    const report = await service.submitReport({
      actor: requester,
      targetType: "post",
      targetId: conversation.related_post_ids[0]!,
      reason: "other",
      detailText: "Needs moderator review",
    });

    expect(report.target_type).toBe("post");
    expect(report.community_id).toBe(communityId);
  });

  it("creates a user report without conversation context when the community is unambiguous", async () => {
    const repository = new InMemoryChatRepository();
    seedConversation(repository);
    const service = new DefaultChatService(repository, defaultChatSafetyDetector, {});

    const report = await service.submitReport({
      actor: requester,
      targetType: "user",
      targetId: recipient.userId,
      targetCommunityIds: recipient.communityIds,
      reason: "harassment",
      detailText: "Unsafe coordination outside the app",
    });

    expect(report.target_type).toBe("user");
    expect(report.community_id).toBe(communityId);
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
