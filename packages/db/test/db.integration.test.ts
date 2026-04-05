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
});
