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

  it("rolls back invalid remove_post report decisions inside a transaction", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              report_id: "11111111-1111-4111-8111-111111111111",
              community_id: "22222222-2222-4222-8222-222222222222",
              target_type: "message",
              target_id: "33333333-3333-4333-8333-333333333333",
              reason: "unsafe_behavior",
              detail_text: "Needs review",
              conversation_id: "44444444-4444-4444-8444-444444444444",
              reporter_user_id: "55555555-5555-4555-8555-555555555555",
              status: "new",
              resolution: null,
              created_at: "2026-04-10T12:00:00.000Z",
              resolved_at: null,
              reporter_alias: "Reporter",
              priority: "P0",
              target_title: "Message report",
              body_preview: "Needs review",
              related_user_id: "66666666-6666-4666-8666-666666666666",
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const repository = new PgChatRepository({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(),
    });

    await expect(
      repository.decideReport({
        communityId: "22222222-2222-4222-8222-222222222222",
        reportId: "11111111-1111-4111-8111-111111111111",
        decision: "remove_post",
        notes: null,
        anchorUserId: "77777777-7777-4777-8777-777777777777",
        decidedAt: "2026-04-10T12:05:00.000Z",
      }),
    ).rejects.toMatchObject({
      name: "ChatServiceError",
      code: "invalid_input",
    });

    expect(client.query.mock.calls[0]?.[0]).toBe("begin");
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("rollback");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("records audit side effects when auto-hide removes a post", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ threshold: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ report_count: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ post_id: "post-1" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ report_id: "report-2" }, { report_id: "report-1" }], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [{ anchor_user_id: "anchor-1" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const repository = new PgChatRepository({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(),
    });

    const removed = await repository.autoHidePostIfThresholdReached({
      communityId: "community-1",
      postId: "post-1",
    });

    expect(removed).toBe(true);
    expect(client.query.mock.calls[6]?.[0]).toContain("update reports");
    expect(client.query.mock.calls[7]?.[0]).toContain("insert into moderation_actions");
    expect(client.query.mock.calls[7]?.[1]).toEqual(["anchor-1", "community-1", "post-1", ["report-2", "report-1"]]);
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("commit");
  });

  it("records a system audit entry when auto-hide removes a post without an active anchor", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ threshold: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ report_count: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ post_id: "post-1" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ report_id: "report-1" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const repository = new PgChatRepository({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(),
    });

    const removed = await repository.autoHidePostIfThresholdReached({
      communityId: "community-1",
      postId: "post-1",
    });

    expect(removed).toBe(true);
    expect(client.query.mock.calls[7]?.[0]).toContain("insert into moderation_actions");
    expect(client.query.mock.calls[7]?.[1]).toEqual([null, "community-1", "post-1", ["report-1"]]);
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("commit");
  });
});
