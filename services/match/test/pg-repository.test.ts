import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import { PgMatchRepository } from "../src/pg-repository.js";

describe("PgMatchRepository", () => {
  it("returns the existing active contact request when the active-pair unique index trips", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce({
        code: "23505",
        constraint: "uq_contact_requests_active_pair",
      })
      .mockResolvedValueOnce({
        rows: [
          {
            contact_request_id: "11111111-1111-4111-8111-111111111111",
            from_post_id: "22222222-2222-4222-8222-222222222222",
            to_post_id: "33333333-3333-4333-8333-333333333333",
            requester_user_id: "44444444-4444-4444-8444-444444444444",
            recipient_user_id: "55555555-5555-4555-8555-555555555555",
            requester_alias: "Requester",
            status: "pending",
            created_at: "2026-04-07T12:00:00.000Z",
            expires_at: "2026-04-10T12:00:00.000Z",
            responded_at: null,
          },
        ],
      });
    const repository = new PgMatchRepository(
      { query } as unknown as Pool,
      async () => [],
    );

    const result = await repository.saveContactRequest({
      contactRequestId: "66666666-6666-4666-8666-666666666666",
      fromPostId: "22222222-2222-4222-8222-222222222222",
      toPostId: "33333333-3333-4333-8333-333333333333",
      requesterUserId: "44444444-4444-4444-8444-444444444444",
      recipientUserId: "55555555-5555-4555-8555-555555555555",
      requesterAlias: "Requester",
      status: "pending",
      createdAt: "2026-04-07T12:00:00.000Z",
      expiresAt: "2026-04-10T12:00:00.000Z",
      respondedAt: null,
    });

    expect(result.contactRequestId).toBe("11111111-1111-4111-8111-111111111111");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("returns the persisted accepted conversation record when contact-request conflict wins", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            conversation_id: "77777777-7777-4777-8777-777777777777",
            contact_request_id: "88888888-8888-4888-8888-888888888888",
            related_post_ids: [
              "99999999-9999-4999-8999-999999999999",
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            ],
            created_at: "2026-04-07T12:00:00.000Z",
            requester_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            requester_alias: "Requester",
            recipient_user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            recipient_alias: "Recipient",
          },
        ],
      });
    const repository = new PgMatchRepository(
      { query } as unknown as Pool,
      async () => [],
    );

    const result = await repository.saveAcceptedConversation({
      conversation_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      contact_request_id: "88888888-8888-4888-8888-888888888888",
      related_post_ids: [
        "99999999-9999-4999-8999-999999999999",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ],
      participant_preview: [
        {
          user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          alias: "Requester",
        },
        {
          user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          alias: "Recipient",
        },
      ],
      status: "accepted_contact",
      created_at: "2026-04-07T12:00:00.000Z",
    });

    expect(result.conversation_id).toBe("77777777-7777-4777-8777-777777777777");
    expect(query).toHaveBeenCalledTimes(2);
  });
});
