import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { createPostsRuntime } from "../src/runtime.js";

const internalSecret = "weavenyc-dev-internal-service-jwt-secret";
const internalIssuer = "weavenyc-api-gateway:internal";
const internalAudience = "posts-service";

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

describe("posts runtime", () => {
  const runtimes: Array<ReturnType<typeof createPostsRuntime>> = [];

  afterEach(async () => {
    while (runtimes.length > 0) {
      await runtimes.pop()!.close();
    }
  });

  it("exposes internal service methods behind JWT auth", async () => {
    const calls: string[] = [];
    const runtime = createPostsRuntime({
      service: {
        async ping() {},
        async close() {},
        async resolveCommunityAccess() {
          calls.push("resolveCommunityAccess");
          return {
            community: {
              community_id: "44444444-4444-4444-8444-444444444444",
              name: "Test Community",
              center_zip: "11735",
              join_policy: "invite_only",
            },
            join_token: "join-token",
            entry: "invite_code",
            expires_in_seconds: 600,
          };
        },
      } as never,
      readinessCheck: async () => [{ name: "postgres", status: "ok" }],
    });
    runtimes.push(runtime);

    await runtime.listen();
    const baseUrl = runtime.baseUrl();

    const unauthorized = await fetch(`${baseUrl}/internal/v1/posts/resolve-community-access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invite_code: "ABC123" }),
    });
    expect(unauthorized.status).toBe(401);

    const response = await fetch(`${baseUrl}/internal/v1/posts/resolve-community-access`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${signInternalToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ invite_code: "ABC123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      entry: "invite_code",
      join_token: "join-token",
    });
    expect(calls).toEqual(["resolveCommunityAccess"]);
  });
});
