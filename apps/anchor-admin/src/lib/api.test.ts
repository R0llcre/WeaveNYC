import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchHealth } from "./api";

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
});
