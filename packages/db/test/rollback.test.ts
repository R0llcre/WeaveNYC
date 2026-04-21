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
});
