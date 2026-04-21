import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve(process.cwd(), "packages/db/migrations");

describe("rollback SQL files (A8 P0-4)", () => {
  it("pair 0013 with an inverse SQL", () => {
    const rollback = readFileSync(
      path.join(migrationsDir, "0013_p2p_sync_compound_index.rollback.sql"),
      "utf8",
    );
    expect(rollback).toContain("DROP INDEX IF EXISTS idx_community_sync_events_community_cursor");
    expect(rollback).toContain(
      "CREATE INDEX IF NOT EXISTS idx_community_sync_events_community_occurred_at",
    );
    expect(rollback).toMatch(/BEGIN;[\s\S]*COMMIT;/);
  });

  it("pair 0014 with an inverse SQL", () => {
    const rollback = readFileSync(
      path.join(migrationsDir, "0014_idempotency_keys.rollback.sql"),
      "utf8",
    );
    expect(rollback).toContain("DROP TABLE IF EXISTS idempotency_keys");
    expect(rollback).toContain("ALTER TABLE messages DROP COLUMN IF EXISTS client_message_id");
    expect(rollback).toContain("DROP INDEX IF EXISTS uq_messages_client_dedup");
    expect(rollback).toContain("DROP INDEX IF EXISTS uq_reports_reporter_target_active");
    expect(rollback).toMatch(/BEGIN;[\s\S]*COMMIT;/);
  });

  it("every rollback file has a matching forward migration", () => {
    const entries = readdirSync(migrationsDir).filter((entry) => {
      const full = path.join(migrationsDir, entry);
      return statSync(full).isFile() && entry.endsWith(".rollback.sql");
    });
    expect(entries.length).toBeGreaterThan(0);
    for (const rollbackFile of entries) {
      const forwardFile = rollbackFile.replace(/\.rollback\.sql$/, ".sql");
      const forwardPath = path.join(migrationsDir, forwardFile);
      expect(() => statSync(forwardPath), `missing forward for ${rollbackFile}`).not.toThrow();
    }
  });

  it("every post-SOP forward migration has a paired rollback (F4-B fix #1)", () => {
    // Reverse check: inventory every 4-digit-prefixed forward file and
    // assert the matching `.rollback.sql` exists. Without this, a missing
    // rollback (e.g. 0015 before F4-B) silently bypasses the rollback gate
    // at runtime — scripts/rollback.ts fails loud at the moment an operator
    // tries to use it, which is way too late.
    const forwardFiles = readdirSync(migrationsDir).filter((entry) => {
      if (!entry.endsWith(".sql") || entry.endsWith(".rollback.sql")) {
        return false;
      }
      return /^\d{4}_/.test(entry);
    });
    expect(forwardFiles.length).toBeGreaterThan(0);
    // M0 baseline (0000) through 0010 are the squashed initial-state
    // migrations that predate the rollback SOP (A8 P0-4). The rollback SOP
    // contract starts with 0013. New migrations MUST ship rollbacks; the
    // assertion below enforces that for every post-SOP number.
    const postSopForwards = forwardFiles.filter((filename) => {
      const prefix = Number.parseInt(filename.slice(0, 4), 10);
      return Number.isFinite(prefix) && prefix >= 13;
    });
    for (const forwardFile of postSopForwards) {
      const rollbackFile = forwardFile.replace(/\.sql$/, ".rollback.sql");
      const rollbackPath = path.join(migrationsDir, rollbackFile);
      expect(
        () => statSync(rollbackPath),
        `missing rollback for ${forwardFile}`,
      ).not.toThrow();
    }
  });

  it("pairs 0015 through 0020 with inverse SQL", () => {
    // F4-B explicitly ships 0015 rollback (was missing) and 0016-0020 new
    // migrations. Each must pair. Asserting explicitly so a future PR that
    // accidentally deletes one of these trips the test immediately.
    const requiredPairs = [
      "0015_resources_zip_prefix_index",
      "0016_match_suggestions_candidate_index",
      "0017_analytics_events_fk_and_payload_check",
      "0018_idempotency_keys_user_fk",
      "0019_updated_at_triggers",
      "0020_users_purge_sweep_index",
    ];
    for (const base of requiredPairs) {
      expect(() => statSync(path.join(migrationsDir, `${base}.sql`))).not.toThrow();
      expect(() =>
        statSync(path.join(migrationsDir, `${base}.rollback.sql`)),
      ).not.toThrow();
    }
  });
});
