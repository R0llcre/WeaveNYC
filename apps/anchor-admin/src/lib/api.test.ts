import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnchorRecoveryError,
  decodeJwtPayload,
  fetchHealth,
  normalizeAuthSession,
  submitAnchorRecoveryCode,
} from "./api";

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

  it("submitAnchorRecoveryCode posts normalized payload and returns session response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh",
          user: { user_id: "u1", level: "anchor" },
          remaining_attempts: 4,
        }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const response = await submitAnchorRecoveryCode("token-a", {
      communityId: "comm-a",
      recoveryCode: "abcd-1111",
    });

    expect(response.remaining_attempts).toBe(4);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toMatch(/\/v1\/auth\/anchor\/session\/recovery$/);
    const init = call[1] as RequestInit;
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({ community_id: "comm-a", recovery_code: "ABCD-1111" });
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer token-a");
  });

  it("submitAnchorRecoveryCode wraps 400 errors with remaining_attempts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            message: "Recovery code is invalid or already used",
            remaining_attempts: 2,
          }),
      }),
    );

    await expect(
      submitAnchorRecoveryCode("token-a", {
        communityId: "comm-a",
        recoveryCode: "abcd-1111",
      }),
    ).rejects.toMatchObject({
      status: 400,
      remainingAttempts: 2,
    });
  });

  it("submitAnchorRecoveryCode surfaces retry-after on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "125" }),
        text: async () =>
          JSON.stringify({
            message: "Too many anchor recovery attempts. Retry in 125s.",
            remaining_attempts: 0,
          }),
      }),
    );

    let captured: AnchorRecoveryError | null = null;
    try {
      await submitAnchorRecoveryCode("token-a", {
        communityId: "comm-a",
        recoveryCode: "abcd-1111",
      });
    } catch (error) {
      if (error instanceof AnchorRecoveryError) {
        captured = error;
      }
    }

    expect(captured).not.toBeNull();
    expect(captured?.status).toBe(429);
    expect(captured?.retryAfterSeconds).toBe(125);
    expect(captured?.remainingAttempts).toBe(0);
  });
});
