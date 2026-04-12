import { afterEach, describe, expect, it, vi } from "vitest";

import { decodeJwtPayload, fetchHealth, normalizeAuthSession } from "./api";

describe("anchor admin api helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats parsed health responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: "ok",
          service: "api-gateway",
          timestamp: "2026-04-04T12:00:00.000Z",
        }),
      }),
    );

    await expect(fetchHealth("/healthz")).resolves.toMatchObject({
      ok: true,
      detail: "api-gateway ok",
    });
  });

  it("decodes jwt payloads", () => {
    const payload = {
      sub: "user-123",
      level: "anchor",
      role: "anchor",
      community_ids: ["comm_a", "comm_b"],
    };
    const token = [
      "header",
      Buffer.from(JSON.stringify(payload)).toString("base64url"),
      "signature",
    ].join(".");

    expect(decodeJwtPayload(token)).toMatchObject(payload);
  });

  it("normalizes token pairs from mixed refresh responses", () => {
    expect(
      normalizeAuthSession({
        access_token: "access",
        refreshToken: "refresh",
        user: {
          level: "verified",
        },
      }),
    ).toMatchObject({
      accessToken: "access",
      refreshToken: "refresh",
      user: { level: "verified" },
    });
  });
});
