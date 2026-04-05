import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve(process.cwd(), "packages/db/migrations/0000_m0_initial.sql"),
  "utf8"
);

describe("initial migration", () => {
  it("contains required M0 constraints", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_versions_dataset_version");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_versions_source_version");
    expect(migration).toContain("PRIMARY KEY (user_id, community_id)");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_active_source_ref");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_contact_request_id");
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS postgis;");
  });
});
