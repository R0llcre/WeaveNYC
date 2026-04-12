import { describe, expect, it, vi } from "vitest";

import { PgChatRepository } from "../src/pg-repository.js";

describe("PgChatRepository", () => {
  it("reuses the existing block when the pair unique index trips", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce({
        code: "23505",
        constraint: "uq_blocks_pair",
      })
      .mockResolvedValueOnce({
        rows: [
          {
            block_id: "11111111-1111-4111-8111-111111111111",
            blocker_user_id: "22222222-2222-4222-8222-222222222222",
            blocked_user_id: "33333333-3333-4333-8333-333333333333",
            conversation_id: "44444444-4444-4444-8444-444444444444",
            created_at: "2026-04-10T12:00:00.000Z",
          },
        ],
      });
    const repository = new PgChatRepository({ query });

    const block = await repository.saveBlock({
      blockerUserId: "22222222-2222-4222-8222-222222222222",
      blockedUserId: "33333333-3333-4333-8333-333333333333",
      conversationId: "44444444-4444-4444-8444-444444444444",
      createdAt: "2026-04-10T12:00:00.000Z",
    });

    expect(block.block_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("writes the read pointer with an upsert", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repository = new PgChatRepository({ query });

    await repository.markConversationRead({
      conversationId: "55555555-5555-4555-8555-555555555555",
      userId: "66666666-6666-4666-8666-666666666666",
      messageId: "77777777-7777-4777-8777-777777777777",
      readAt: "2026-04-10T12:03:00.000Z",
    });

    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[0]).toContain("on conflict (conversation_id, user_id) do update");
  });

  it("casts conversation status updates to the enum type", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ conversation_id: "88888888-8888-4888-8888-888888888888" }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            conversation_id: "88888888-8888-4888-8888-888888888888",
            contact_request_id: "99999999-9999-4999-8999-999999999999",
            related_post_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
            participant_preview: [],
            status: "blocked",
            created_at: "2026-04-10T12:00:00.000Z",
            last_activity_at: "2026-04-10T12:04:00.000Z",
            last_message_preview: null,
            unread_count: 0,
            other_user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          },
        ],
        rowCount: 1,
      });
    const repository = new PgChatRepository({ query });

    await repository.updateConversationState({
      conversationId: "88888888-8888-4888-8888-888888888888",
      status: "blocked",
      changedAt: "2026-04-10T12:04:00.000Z",
      blockedByUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });

    expect(query.mock.calls[0]?.[0]).toContain("$2::conversation_status");
  });
});
