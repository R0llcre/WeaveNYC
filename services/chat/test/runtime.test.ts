import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { createChatRuntime } from "../src/runtime.js";

const internalSecret = "weavenyc-dev-internal-service-jwt-secret";
const internalIssuer = "weavenyc-api-gateway:internal";
const internalAudience = "chat-service";

function signInternalToken(actorSub = "22222222-2222-4222-8222-222222222222") {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: internalIssuer,
    aud: internalAudience,
    scope: "internal_service",
    request_id: "request-1",
    actor: {
      sub: actorSub,
      level: "verified",
      role: "user",
      community_ids: ["44444444-4444-4444-8444-444444444444"],
      status: "active",
    },
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  const headerPart = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", internalSecret)
    .update(`${headerPart}.${payloadPart}`)
    .digest("base64url");

  return `${headerPart}.${payloadPart}.${signature}`;
}

describe("chat runtime", () => {
  const runtimes: Array<ReturnType<typeof createChatRuntime>> = [];

  afterEach(async () => {
    while (runtimes.length > 0) {
      await runtimes.pop()!.close();
    }
  });

  it("exposes internal service methods behind JWT auth", async () => {
    const calls: string[] = [];
    const runtime = createChatRuntime({
      service: {
        async close() {},
        async listConversations() {
          calls.push("listConversations");
          return { items: [], nextCursor: null };
        },
        async listConversationIdsForPair() {
          calls.push("listConversationIdsForPair");
          return [];
        },
        async getConversation() {
          calls.push("getConversation");
          return {
            conversation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            contact_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            participant_user_ids: ["u1", "u2"],
            participant_preview: [
              { user_id: "u1", alias: "A" },
              { user_id: "u2", alias: "B" },
            ],
            related_post_ids: [],
            status: "active",
            created_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
            closed_at: null,
            blocked_at: null,
            blocked_by_user_id: null,
            last_message_preview: null,
            last_message_at: null,
            unread_count: 0,
            other_participant: { user_id: "u2", alias: "B" },
            can_send: true,
          };
        },
        async listMessages() {
          return {
            conversation: {
              conversation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              contact_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              participant_user_ids: ["u1", "u2"],
              participant_preview: [
                { user_id: "u1", alias: "A" },
                { user_id: "u2", alias: "B" },
              ],
              related_post_ids: [],
              status: "active",
              created_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
              closed_at: null,
              blocked_at: null,
              blocked_by_user_id: null,
              last_message_preview: null,
              last_message_at: null,
              unread_count: 0,
              other_participant: { user_id: "u2", alias: "B" },
              can_send: true,
            },
            items: [],
            next_cursor: null,
          };
        },
        async sendMessage() {
          calls.push("sendMessage");
          return {
            conversation: {
              conversation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              contact_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              participant_user_ids: ["u1", "u2"],
              participant_preview: [
                { user_id: "u1", alias: "A" },
                { user_id: "u2", alias: "B" },
              ],
              related_post_ids: [],
              status: "active",
              created_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
              closed_at: null,
              blocked_at: null,
              blocked_by_user_id: null,
              last_message_preview: null,
              last_message_at: null,
              unread_count: 0,
              other_participant: { user_id: "u2", alias: "B" },
              can_send: true,
            },
            message: {
              message_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              conversation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              sender_user_id: "u1",
              body: "hello",
              safety_flags: [],
              sent_at: new Date().toISOString(),
            },
          };
        },
        async closeConversation() {
          return {} as never;
        },
        async blockUser() {
          return { block: {} as never, affectedConversations: [] };
        },
        async submitReport() {
          return {
            report: {} as never,
            communityId: "44444444-4444-4444-8444-444444444444",
            autoHiddenPostId: null,
            autoHiddenActorUserId: null,
            autoHiddenReportIds: [],
            autoHiddenModerationActionIds: {},
          };
        },
        async listReportQueue() {
          return { items: [], nextCursor: null };
        },
        async decideReport() {
          calls.push("decideReport");
          return {} as never;
        },
      } as never,
      readinessCheck: async () => [{ name: "postgres", status: "ok" }],
    });
    runtimes.push(runtime);

    await runtime.listen();
    const baseUrl = runtime.baseUrl();

    const unauthorized = await fetch(`${baseUrl}/internal/v1/chat/get-conversation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });
    expect(unauthorized.status).toBe(401);

    const response = await fetch(`${baseUrl}/internal/v1/chat/get-conversation`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${signInternalToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ conversation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      conversation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });

    const pairResponse = await fetch(`${baseUrl}/internal/v1/chat/list-conversation-ids-for-pair`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${signInternalToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ other_user_id: "33333333-3333-4333-8333-333333333333" }),
    });

    expect(pairResponse.status).toBe(200);
    await expect(pairResponse.json()).resolves.toEqual([]);
    expect(calls).toEqual(["getConversation", "listConversationIdsForPair"]);
  });
});
