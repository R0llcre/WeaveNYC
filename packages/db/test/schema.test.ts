import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { seedIds } from "../seed/fixtures";

const migrationPath = path.resolve(__dirname, "../migrations/0000_m0_initial.sql");

describe("@weavenyc/db migration contract", () => {
  it("contains the required M0 invariants", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("uq_dataset_versions_dataset_version");
    expect(sql).toContain("uq_conversations_contact_request_id");
    expect(sql).toContain("uq_resources_active_source_ref");
    expect(sql).toContain("PRIMARY KEY (user_id, community_id)");
  });

  it("uses deterministic fixture IDs", () => {
    expect(seedIds.communityId).toBe("44444444-4444-4444-8444-444444444444");
  });
});
