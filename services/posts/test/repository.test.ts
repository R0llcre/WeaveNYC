import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import { PostsRepository } from "../src/repository.js";

describe("PostsRepository community rules sanitization", () => {
  it("filters invalid DB rule values before returning API payloads", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            ruleset_id: "11111111-1111-4111-8111-111111111111",
            community_id: "22222222-2222-4222-8222-222222222222",
            review_categories: ["food", "invalid-category", "food", "transportation"],
            auto_hide_report_threshold: 99,
            keyword_blocklist: [" cash only ", "", "x".repeat(121), "cash only"],
            language_preferences: ["en", "invalid-lang", "zh", "en"],
            announcement_pin_strategy: "not-a-real-strategy",
            updated_at: "2026-04-12T12:00:00.000Z",
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Pool;

    const repository = new PostsRepository(pool);
    const rules = await repository.getCommunityRules("22222222-2222-4222-8222-222222222222");

    expect(rules).toEqual({
      community_id: "22222222-2222-4222-8222-222222222222",
      review_categories: ["food", "transportation"],
      auto_hide_report_threshold: 20,
      keyword_blocklist: ["cash only"],
      language_preferences: ["en", "zh"],
      announcement_pin_strategy: "latest",
      updated_at: "2026-04-12T12:00:00.000Z",
    });
  });
});
