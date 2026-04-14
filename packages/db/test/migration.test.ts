import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrations = ["0000_m0_initial.sql", "0001_m1_remediation.sql", "0002_m2_community_posts.sql", "0003_m3_matching_inbox.sql", "0004_m4_chat_safety.sql", "0005_m4_report_broadening.sql", "0006_m5_anchor_admin.sql", "0007_m5_contract_hardening.sql", "0008_m5_report_status_cleanup.sql", "0009_m6_p2p_sync.sql"]
  .map((filename) =>
    readFileSync(path.resolve(process.cwd(), "packages/db/migrations", filename), "utf8")
  )
  .join("\n");

describe("initial migration", () => {
  it("contains required M0 through M6 constraints", () => {
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_versions_source_version");
    expect(migrations).toContain("PRIMARY KEY (user_id, community_id)");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_active_source_ref");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_contact_request_id");
    expect(migrations).toContain("CREATE EXTENSION IF NOT EXISTS postgis;");
    expect(migrations).toContain("DROP INDEX IF EXISTS uq_dataset_versions_dataset_version");
    expect(migrations).toContain("ADD COLUMN IF NOT EXISTS phone_hash_salt");
    expect(migrations).toContain("fk_resource_providers_source_dataset_version");
    expect(migrations).toContain("fk_resource_change_logs_source_dataset_version");
    expect(migrations).toContain("community_access_channel");
    expect(migrations).toContain("CREATE TABLE IF NOT EXISTS community_access_codes");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_community_access_codes_active_channel_code");
    expect(migrations).toContain("ALTER TABLE match_suggestions");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_match_suggestions_request_candidate");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_match_suggestions_request_batch_position");
    expect(migrations).toContain("CREATE INDEX IF NOT EXISTS idx_contact_requests_requester_status");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_requests_active_pair");
    expect(migrations).toContain("CREATE TYPE conversation_status");
    expect(migrations).toContain("CREATE TABLE IF NOT EXISTS conversation_reads");
    expect(migrations).toContain("CREATE TABLE IF NOT EXISTS blocks");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_blocks_pair");
    expect(migrations).toContain("CREATE INDEX IF NOT EXISTS idx_messages_sender_sent_at");
    expect(migrations).toContain("community_id");
    expect(migrations).toContain("idx_reports_community_created_at");
    expect(migrations).toContain("CREATE TABLE IF NOT EXISTS anchor_invites");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_anchor_invites_code_hash");
    expect(migrations).toContain("CREATE TABLE IF NOT EXISTS community_rulesets");
    expect(migrations).toContain("chk_community_rulesets_review_categories_valid");
    expect(migrations).toContain("chk_community_rulesets_language_preferences_valid");
    expect(migrations).toContain("chk_community_rulesets_auto_hide_report_threshold");
    expect(migrations).toContain("fk_communities_ruleset_id");
    expect(migrations).toContain("ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(user_id)");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_anchors_active_community");
    expect(migrations).toContain("CREATE TABLE IF NOT EXISTS announcements");
    expect(migrations).toContain("is_pinned boolean NOT NULL DEFAULT false");
    expect(migrations).toContain("ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(conversation_id)");
    expect(migrations).toContain("CREATE INDEX IF NOT EXISTS idx_reports_community_status_created_at");
    expect(migrations).toContain("CREATE INDEX IF NOT EXISTS idx_moderation_actions_report_id");
    expect(migrations).toContain("alter type report_status rename to report_status_old");
    expect(migrations).toContain("create type report_status as enum ('new', 'resolved', 'dismissed')");
    expect(migrations).toContain("alter column anchor_user_id drop not null");
    expect(migrations).toContain("ADD COLUMN IF NOT EXISTS p2p_version integer NOT NULL DEFAULT 1");
    expect(migrations).toContain("ADD COLUMN IF NOT EXISTS ipfs_cid varchar(100)");
    expect(migrations).toContain("CREATE TABLE IF NOT EXISTS community_sync_events");
    expect(migrations).toContain("CREATE INDEX IF NOT EXISTS idx_community_sync_events_community_occurred_at");
    expect(migrations).toContain("CREATE INDEX IF NOT EXISTS idx_community_sync_events_aggregate_occurred_at");
  });
});
