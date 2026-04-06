import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { seedIds } from "../seed/fixtures";

const migrationPaths = ["0000_m0_initial.sql", "0001_m1_remediation.sql", "0002_m2_community_posts.sql"].map((filename) =>
  path.resolve(__dirname, "../migrations", filename)
);

describe("@weavenyc/db migration contract", () => {
  it("contains the required M0, M1, and M2 invariants", () => {
    const sql = migrationPaths.map((migrationPath) => readFileSync(migrationPath, "utf8")).join("\n");

    expect(sql).toContain("uq_dataset_versions_source_version");
    expect(sql).toContain("DROP INDEX IF EXISTS uq_dataset_versions_dataset_version");
    expect(sql).toContain("uq_conversations_contact_request_id");
    expect(sql).toContain("uq_resources_active_source_ref");
    expect(sql).toContain("PRIMARY KEY (user_id, community_id)");
    expect(sql).toContain("phone_hash_salt");
    expect(sql).toContain("fk_resource_providers_source_dataset_version");
    expect(sql).toContain("community_access_codes");
    expect(sql).toContain("idx_community_access_codes_channel_code");
    expect(sql).toContain("uq_community_access_codes_active_channel_code");
  });

  it("uses deterministic fixture IDs", () => {
    expect(seedIds.communityId).toBe("44444444-4444-4444-8444-444444444444");
  });
});
