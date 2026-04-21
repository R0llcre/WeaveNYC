import { describe, expect, it, vi } from "vitest";

import { PgChatRepository } from "../src/pg-repository.js";

describe("PgChatRepository", () => {
  const autoHideCommunityId = "11111111-1111-4111-8111-111111111111";
  const autoHidePostId = "22222222-2222-4222-8222-222222222222";
  const autoHideReportOneId = "33333333-3333-4333-8333-333333333333";
  const autoHideReportTwoId = "44444444-4444-4444-8444-444444444444";
  const autoHideAnchorId = "55555555-5555-4555-8555-555555555555";
  const autoHideActionOneId = "66666666-6666-4666-8666-666666666666";
  const autoHideActionTwoId = "77777777-7777-4777-8777-777777777777";

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
        .mockResolvedValueOnce({ rows: [{ reporter_count: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ post_id: autoHidePostId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ report_id: autoHideReportTwoId }, { report_id: autoHideReportOneId }], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [{ anchor_user_id: autoHideAnchorId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 2 })
        .mockResolvedValueOnce({
          rows: [
            {
              action_id: autoHideActionTwoId,
              report_id: autoHideReportTwoId,
            },
            {
              action_id: autoHideActionOneId,
              report_id: autoHideReportOneId,
            },
          ],
          rowCount: 2,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const repository = new PgChatRepository({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(),
    });

    const removed = await repository.autoHidePostIfThresholdReached({
      communityId: autoHideCommunityId,
      postId: autoHidePostId,
    });

    expect(removed).toMatchObject({
      postId: autoHidePostId,
      communityId: autoHideCommunityId,
      anchorUserId: autoHideAnchorId,
      reportIds: [autoHideReportTwoId, autoHideReportOneId],
    });
    expect(removed?.syncEvents).toHaveLength(3);
    expect(client.query.mock.calls[6]?.[0]).toContain("update reports");
    expect(client.query.mock.calls[7]?.[0]).toContain("insert into moderation_actions");
    expect(client.query.mock.calls[7]?.[1]).toMatchObject([
      autoHideAnchorId,
      autoHideCommunityId,
      autoHidePostId,
      [autoHideReportTwoId, autoHideReportOneId],
      expect.any(String),
    ]);
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("commit");
  });

  it("uses moderation action ids for report decision sync events", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              report_id: "11111111-1111-4111-8111-111111111111",
              community_id: "22222222-2222-4222-8222-222222222222",
              target_type: "post",
              target_id: "33333333-3333-4333-8333-333333333333",
              reason: "unsafe_behavior",
              detail_text: "Needs review",
              conversation_id: null,
              reporter_user_id: "44444444-4444-4444-8444-444444444444",
              status: "new",
              resolution: null,
              created_at: "2026-04-10T12:00:00.000Z",
              resolved_at: null,
              reporter_alias: "Reporter",
              priority: "P0",
              target_title: "Reported post",
              body_preview: "Needs review",
              related_user_id: "55555555-5555-4555-8555-555555555555",
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const repository = new PgChatRepository({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(),
    });

    const decision = await repository.decideReport({
      communityId: "22222222-2222-4222-8222-222222222222",
      reportId: "11111111-1111-4111-8111-111111111111",
      decision: "warn",
      notes: "Please verify details.",
      anchorUserId: "66666666-6666-4666-8666-666666666666",
      decidedAt: "2026-04-10T12:05:00.000Z",
    });

    const moderationInsertCall = client.query.mock.calls.find(([sql]) =>
      typeof sql === "string" && sql.includes("insert into moderation_actions"),
    );
    const insertedActionId = moderationInsertCall?.[1]?.[0];
    expect(decision).not.toBeNull();
    const syncEvents = decision?.syncEvents ?? [];
    expect(insertedActionId).toEqual(expect.any(String));
    expect(syncEvents).toHaveLength(1);
    expect(syncEvents[0]).toMatchObject({
      aggregate_id: insertedActionId,
      event_type: "moderation.decision",
    });
  });

  it("uses inserted moderation action ids for auto-hide sync events", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ threshold: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ reporter_count: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ post_id: autoHidePostId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ report_id: autoHideReportTwoId }, { report_id: autoHideReportOneId }], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [{ anchor_user_id: autoHideAnchorId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 2 })
        .mockResolvedValueOnce({
          rows: [
            {
              action_id: autoHideActionTwoId,
              report_id: autoHideReportTwoId,
            },
            {
              action_id: autoHideActionOneId,
              report_id: autoHideReportOneId,
            },
          ],
          rowCount: 2,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const repository = new PgChatRepository({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(),
    });

    const removed = await repository.autoHidePostIfThresholdReached({
      communityId: autoHideCommunityId,
      postId: autoHidePostId,
    });

    const moderationEvents =
      removed?.syncEvents.filter((event) => event.event_type === "moderation.decision") ?? [];
    expect(moderationEvents).toHaveLength(2);
    expect(moderationEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ aggregate_id: autoHideActionTwoId }),
        expect.objectContaining({ aggregate_id: autoHideActionOneId }),
      ]),
    );
  });

  it("returns terminal report decisions without adding sync events or moderation rows", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              report_id: "11111111-1111-4111-8111-111111111111",
              community_id: "22222222-2222-4222-8222-222222222222",
              target_type: "post",
              target_id: "33333333-3333-4333-8333-333333333333",
              reason: "unsafe_behavior",
              detail_text: "Needs review",
              conversation_id: null,
              reporter_user_id: "44444444-4444-4444-8444-444444444444",
              status: "resolved",
              resolution: "remove_post",
              created_at: "2026-04-10T12:00:00.000Z",
              resolved_at: "2026-04-10T12:05:00.000Z",
              reporter_alias: "Reporter",
              priority: "P0",
              target_title: "Reported post",
              body_preview: "Needs review",
              related_user_id: "55555555-5555-4555-8555-555555555555",
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

    const decision = await repository.decideReport({
      communityId: "22222222-2222-4222-8222-222222222222",
      reportId: "11111111-1111-4111-8111-111111111111",
      decision: "remove_post",
      notes: "Retry should be idempotent.",
      anchorUserId: "66666666-6666-4666-8666-666666666666",
      decidedAt: "2026-04-10T12:06:00.000Z",
    });

    expect(decision).toMatchObject({
      report_id: "11111111-1111-4111-8111-111111111111",
      status: "resolved",
      resolution: "remove_post",
      syncEvents: [],
    });
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[0]?.[0]).toBe("begin");
    expect(client.query.mock.calls[2]?.[0]).toBe("commit");
  });

  it("records a system audit entry when auto-hide removes a post without an active anchor", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ threshold: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ reporter_count: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ post_id: autoHidePostId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ report_id: autoHideReportOneId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 2 })
        .mockResolvedValueOnce({
          rows: [
            {
              action_id: autoHideActionOneId,
              report_id: autoHideReportOneId,
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

    const removed = await repository.autoHidePostIfThresholdReached({
      communityId: autoHideCommunityId,
      postId: autoHidePostId,
    });

    expect(removed).toMatchObject({
      postId: autoHidePostId,
      communityId: autoHideCommunityId,
      anchorUserId: null,
      reportIds: [autoHideReportOneId],
    });
    expect(removed?.syncEvents).toHaveLength(2);
    expect(client.query.mock.calls[7]?.[0]).toContain("insert into moderation_actions");
    expect(client.query.mock.calls[7]?.[1]).toMatchObject([
      null,
      autoHideCommunityId,
      autoHidePostId,
      [autoHideReportOneId],
      expect.any(String),
    ]);
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("commit");
  });

  it("saveMessage commits the row when the atomic predicate matches", async () => {
    const client = {
      query: vi
        .fn()
        // begin
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // atomic insert: predicate matched, row returned
        .mockResolvedValueOnce({
          rows: [
            {
              message_id: "11111111-1111-4111-8111-111111111111",
              conversation_id: "22222222-2222-4222-8222-222222222222",
              sender_user_id: "33333333-3333-4333-8333-333333333333",
              body: "hello",
              safety_flags: [],
              sent_at: "2026-04-10T12:05:00.000Z",
            },
          ],
          rowCount: 1,
        })
        // update conversations.last_activity_at
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        // commit
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const repository = new PgChatRepository({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(),
    });

    const message = await repository.saveMessage({
      conversationId: "22222222-2222-4222-8222-222222222222",
      senderUserId: "33333333-3333-4333-8333-333333333333",
      body: "hello",
      safetyFlags: [],
      sentAt: "2026-04-10T12:05:00.000Z",
    });

    expect(message.message_id).toBe("11111111-1111-4111-8111-111111111111");
    const sqls = client.query.mock.calls.map((call) => String(call[0]));
    expect(sqls[0]).toBe("begin");
    // The INSERT uses `select ... where exists (...)` — this is the atomic
    // check-and-insert that closes the A2 P0-8 TOCTOU.
    expect(sqls[1]).toMatch(/insert into messages/i);
    expect(sqls[1]).toMatch(/where exists/i);
    expect(sqls[1]).toMatch(/not exists \(\s*select 1 from blocks/i);
    expect(sqls.at(-1)).toBe("commit");
  });

  it("saveMessage raises conversation_blocked when a block exists between participants", async () => {
    const client = {
      query: vi
        .fn()
        // begin
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // atomic insert rejected by predicate
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // diagnostic SELECT: conversation still active, sender is a
        // participant, but there is an active block
        .mockResolvedValueOnce({
          rows: [
            {
              status: "active",
              participants_include_sender: true,
              has_active_block: true,
            },
          ],
          rowCount: 1,
        })
        // rollback (we throw inside the transaction)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const repository = new PgChatRepository({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(),
    });

    await expect(
      repository.saveMessage({
        conversationId: "22222222-2222-4222-8222-222222222222",
        senderUserId: "33333333-3333-4333-8333-333333333333",
        body: "still there?",
        safetyFlags: [],
        sentAt: "2026-04-10T12:05:00.000Z",
      }),
    ).rejects.toMatchObject({
      name: "ChatServiceError",
      code: "conversation_blocked",
    });

    const sqls = client.query.mock.calls.map((call) => String(call[0]));
    expect(sqls[0]).toBe("begin");
    expect(sqls.at(-1)).toBe("rollback");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("saveMessage raises conversation_closed when the conversation is no longer active", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              status: "closed",
              participants_include_sender: true,
              has_active_block: false,
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
      repository.saveMessage({
        conversationId: "22222222-2222-4222-8222-222222222222",
        senderUserId: "33333333-3333-4333-8333-333333333333",
        body: "hello",
        safetyFlags: [],
        sentAt: "2026-04-10T12:05:00.000Z",
      }),
    ).rejects.toMatchObject({
      name: "ChatServiceError",
      code: "conversation_closed",
    });
  });

  it("records the resolved moderation target for suspend_user decisions", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            report_id: "11111111-1111-4111-8111-111111111111",
            community_id: "22222222-2222-4222-8222-222222222222",
            target_type: "post",
            target_id: "33333333-3333-4333-8333-333333333333",
            reason: "unsafe_behavior",
            detail_text: "Needs review",
            conversation_id: null,
            reporter_user_id: "44444444-4444-4444-8444-444444444444",
            status: "new",
            resolution: null,
            created_at: "2026-04-10T12:00:00.000Z",
            resolved_at: null,
            reporter_alias: "Reporter",
            priority: "P0",
            target_title: "Reported post",
            body_preview: "Needs review",
            related_user_id: "55555555-5555-4555-8555-555555555555",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const repository = new PgChatRepository({ query });

    const decision = await repository.decideReport({
      communityId: "22222222-2222-4222-8222-222222222222",
      reportId: "11111111-1111-4111-8111-111111111111",
      decision: "suspend_user",
      notes: null,
      anchorUserId: "66666666-6666-4666-8666-666666666666",
      decidedAt: "2026-04-10T12:05:00.000Z",
    });

    expect(decision).toMatchObject({
      moderationTargetType: "user",
      moderationTargetId: "55555555-5555-4555-8555-555555555555",
      reportTargetType: "post",
      reportTargetId: "33333333-3333-4333-8333-333333333333",
      affected_user_id: "55555555-5555-4555-8555-555555555555",
    });
  });
});
