import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { seedIds } from "../seed/fixtures";

const migrationPaths = ["0000_m0_initial.sql", "0001_m1_remediation.sql", "0002_m2_community_posts.sql", "0003_m3_matching_inbox.sql", "0004_m4_chat_safety.sql", "0005_m4_report_broadening.sql"].map((filename) =>
  path.resolve(__dirname, "../migrations", filename)
);

describe("@weavenyc/db migration contract", () => {
  it("contains the required M0 through M4 invariants", () => {
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
    expect(sql).toContain("batch_number");
    expect(sql).toContain("uq_match_suggestions_request_candidate");
    expect(sql).toContain("uq_match_suggestions_request_batch_position");
    expect(sql).toContain("idx_contact_requests_requester_status");
    expect(sql).toContain("uq_contact_requests_active_pair");
    expect(sql).toContain("conversation_status");
    expect(sql).toContain("conversation_reads");
    expect(sql).toContain("uq_blocks_pair");
    expect(sql).toContain("idx_messages_sender_sent_at");
    expect(sql).toContain("community_id");
    expect(sql).toContain("idx_reports_community_created_at");
  });

  it("uses deterministic fixture IDs", () => {
    expect(seedIds.communityId).toBe("44444444-4444-4444-8444-444444444444");
  });
});
