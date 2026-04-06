import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrations = ["0000_m0_initial.sql", "0001_m1_remediation.sql"]
  .map((filename) =>
    readFileSync(path.resolve(process.cwd(), "packages/db/migrations", filename), "utf8")
  )
  .join("\n");

describe("initial migration", () => {
  it("contains required M0 and M1 remediation constraints", () => {
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_versions_source_version");
    expect(migrations).toContain("PRIMARY KEY (user_id, community_id)");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_active_source_ref");
    expect(migrations).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_contact_request_id");
    expect(migrations).toContain("CREATE EXTENSION IF NOT EXISTS postgis;");
    expect(migrations).toContain("DROP INDEX IF EXISTS uq_dataset_versions_dataset_version");
    expect(migrations).toContain("ADD COLUMN IF NOT EXISTS phone_hash_salt");
    expect(migrations).toContain("fk_resource_providers_source_dataset_version");
    expect(migrations).toContain("fk_resource_change_logs_source_dataset_version");
  });
});
