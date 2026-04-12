import { readFileSync } from "node:fs";
import path from "node:path";

import { announcements, anchorInvites, anchors, communityRulesets, reports } from "../src/schema";
import { describe, expect, it } from "vitest";

import { seedIds, seedValues } from "../seed/fixtures";

const migrationPaths = ["0000_m0_initial.sql", "0001_m1_remediation.sql", "0002_m2_community_posts.sql", "0003_m3_matching_inbox.sql", "0004_m4_chat_safety.sql", "0005_m4_report_broadening.sql", "0006_m5_anchor_admin.sql", "0007_m5_contract_hardening.sql", "0008_m5_report_status_cleanup.sql"].map((filename) =>
  path.resolve(__dirname, "../migrations", filename)
);

describe("@weavenyc/db migration contract", () => {
  it("contains the required M0 through M5 invariants", () => {
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
    expect(sql).toContain("anchor_invites");
    expect(sql).toContain("uq_anchor_invites_code_hash");
    expect(sql).toContain("community_rulesets");
    expect(sql).toContain("uq_community_rulesets_community");
    expect(sql).toContain("chk_community_rulesets_review_categories_valid");
    expect(sql).toContain("chk_community_rulesets_language_preferences_valid");
    expect(sql).toContain("chk_community_rulesets_auto_hide_report_threshold");
    expect(sql).toContain("uq_anchors_active_community");
    expect(sql).toContain("announcements");
    expect(sql).toContain("is_pinned boolean");
    expect(sql).toContain("conversation_id uuid REFERENCES conversations(conversation_id)");
    expect(sql).toContain("idx_reports_community_status_created_at");
    expect(sql).toContain("idx_moderation_actions_report_id");
    expect(sql).toContain("report_status_old");
    expect(sql).toContain("anchor_user_id drop not null");
  });

  it("uses deterministic M5 fixture ids and values", () => {
    expect(seedIds.communityId).toBe("44444444-4444-4444-8444-444444444444");
    expect(seedIds.anchorInviteId).toBe("5a5a5a5a-5a5a-455a-855a-5a5a5a5a5a5a");
    expect(seedIds.rulesetId).toBe("58585858-5858-4585-8585-585858585858");
    expect(seedIds.announcementId).toBe("59595959-5959-4595-8595-595959595959");
    expect(seedValues.anchorInviteCode).toBe("WEAVE-ANCHOR-11735");
    expect(seedValues.datasetVersion).toBe("cfc_active_2026-04-04");
  });

  it("keeps schema exports aligned with M5 admin storage", () => {
    expect(anchorInvites.codeHash.getSQLType()).toBe("varchar(64)");
    expect(communityRulesets.autoHideReportThreshold.getSQLType()).toBe("integer");
    expect(anchors.totpSecretCiphertext.getSQLType()).toBe("text");
    expect(announcements.isPinned.getSQLType()).toBe("boolean");
    expect(reports.conversationId.getSQLType()).toBe("uuid");
  });
});
