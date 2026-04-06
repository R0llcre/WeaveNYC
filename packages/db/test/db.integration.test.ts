import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { runMigrations } from "../scripts/migrate";
import { runSeed } from "../scripts/seed";
import { getDbEnv } from "../src/env";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe.sequential : describe.skip;

describeDb("db bootstrap", () => {
  const pool = new Pool({
    connectionString: getDbEnv().databaseUrl
  });

  afterAll(async () => {
    await pool.end();
  });

  it("applies migrations idempotently", async () => {
    await runMigrations();
    await runMigrations();

    const tables = await pool.query<{
      users: string | null;
      resources: string | null;
      conversations: string | null;
    }>(`
      select
        to_regclass('public.users') as users,
        to_regclass('public.resource_providers') as resources,
        to_regclass('public.conversations') as conversations;
    `);

    expect(tables.rows[0]).toMatchObject({
      users: "users",
      resources: "resource_providers",
      conversations: "conversations"
    });
  });

  it("seeds canonical fixtures without duplication", async () => {
    await runMigrations();
    await runSeed();
    await runSeed();

    const [communities, activeResources, conversations] = await Promise.all([
      pool.query("select count(*)::int as count from communities"),
      pool.query(`
        select count(*)::int as count
        from resource_providers
        where source = 'cfc_active'
          and source_ref = 'cfc_active:st-kilian-farmingdale'
          and status = 'active'
      `),
      pool.query("select count(*)::int as count from conversations")
    ]);

    expect(communities.rows[0].count).toBeGreaterThanOrEqual(1);
    expect(activeResources.rows[0].count).toBe(1);
    expect(conversations.rows[0].count).toBeGreaterThanOrEqual(1);
  });

  it("upserts seeded dataset versions on the natural source/version key", async () => {
    await runMigrations();

    await pool.query(
      `
        insert into dataset_versions (
          dataset_version_id,
          source,
          dataset_version,
          source_label,
          source_url,
          record_count,
          active_record_count,
          status,
          checksum,
          import_started_at,
          import_completed_at,
          created_at,
          updated_at
        )
        values (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'cfc_active',
          'cfc_active_2026-02-26',
          'Old Source Label',
          'https://example.com/old-cfc',
          99,
          50,
          'stale',
          'old-checksum',
          '2026-01-01T00:00:00Z',
          '2026-01-01T01:00:00Z',
          now(),
          now()
        )
        on conflict do nothing;
      `
    );

    await runSeed();

    const seededRow = await pool.query<{
      dataset_version_id: string;
      source_label: string;
      source_url: string;
      record_count: number;
      status: string;
      checksum: string;
    }>(
      `
        select dataset_version_id, source_label, source_url, record_count, status, checksum
        from dataset_versions
        where source = 'cfc_active' and dataset_version = 'cfc_active_2026-02-26'
      `
    );

    expect(seededRow.rowCount).toBe(1);
    expect(seededRow.rows[0]).toMatchObject({
      dataset_version_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source_label: "NYC HRA Community Food Connection",
      source_url: "https://www1.nyc.gov/assets/hra/downloads/pdf/services/efap/CFC_ACTIVE.pdf",
      record_count: 1,
      status: "active",
      checksum: "cfc_seed_20260405"
    });
  });
});
