import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { createMatchRuntime } from "../src/runtime.js";

const internalSecret = "weavenyc-dev-internal-service-jwt-secret";
const internalIssuer = "weavenyc-api-gateway:internal";
const internalAudience = "match-service";

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

describe("match runtime", () => {
  const runtimes: Array<ReturnType<typeof createMatchRuntime>> = [];

  afterEach(async () => {
    while (runtimes.length > 0) {
      await runtimes.pop()!.close();
    }
  });

  it("exposes internal service methods behind JWT auth", async () => {
    const calls: string[] = [];
    const runtime = createMatchRuntime({
      service: {
        async close() {},
        async ensureInitialSuggestions() {},
        async getSuggestions() {
          calls.push("getSuggestions");
          return {
            post_id: "88888888-8888-4888-8888-888888888888",
            batch_number: 1,
            advanced: false,
            refreshes_used: 0,
            max_refreshes: 1 as const,
            items: [],
          };
        },
        async createContactRequest() {
          return {
            contact_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "pending",
          };
        },
        async listInbox() {
          return { items: [], next_cursor: null };
        },
        async acceptContactRequest() {
          return {
            contact_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "accepted",
            responded_at: new Date().toISOString(),
            conversation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          };
        },
        async rejectContactRequest() {
          return {
            contact_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "rejected",
            responded_at: new Date().toISOString(),
          };
        },
        async getAcceptedConversation() {
          return {
            conversation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            contact_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            related_post_ids: [],
            participant_preview: [
              { user_id: "u1", alias: "A" },
              { user_id: "u2", alias: "B" },
            ],
            status: "accepted_contact",
            created_at: new Date().toISOString(),
          };
        },
      } as never,
      readinessCheck: async () => [{ name: "postgres", status: "ok" }],
    });
    runtimes.push(runtime);

    await runtime.listen();
    const baseUrl = runtime.baseUrl();

    const unauthorized = await fetch(`${baseUrl}/internal/v1/match/get-suggestions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ post_id: "88888888-8888-4888-8888-888888888888" }),
    });
    expect(unauthorized.status).toBe(401);

    const response = await fetch(`${baseUrl}/internal/v1/match/get-suggestions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${signInternalToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ post_id: "88888888-8888-4888-8888-888888888888" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      post_id: "88888888-8888-4888-8888-888888888888",
    });
    expect(calls).toEqual(["getSuggestions"]);
  });
});
