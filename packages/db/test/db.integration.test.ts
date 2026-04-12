import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { runMigrations } from "../scripts/migrate";
import { runSeed } from "../scripts/seed";
import { seedIds, seedValues } from "../seed/fixtures";
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
      anchor_invites: string | null;
      community_rulesets: string | null;
      announcements: string | null;
    }>(`
      select
        to_regclass('public.users') as users,
        to_regclass('public.resource_providers') as resources,
        to_regclass('public.conversations') as conversations,
        to_regclass('public.anchor_invites') as anchor_invites,
        to_regclass('public.community_rulesets') as community_rulesets,
        to_regclass('public.announcements') as announcements;
    `);

    expect(tables.rows[0]).toMatchObject({
      users: "users",
      resources: "resource_providers",
      conversations: "conversations",
      anchor_invites: "anchor_invites",
      community_rulesets: "community_rulesets",
      announcements: "announcements"
    });
  });

  it("seeds canonical fixtures without duplication", async () => {
    await runMigrations();
    await runSeed();
    await runSeed();

    const [communities, activeResources, conversations, anchorInvites, rulesets, announcements, pendingReports] = await Promise.all([
      pool.query("select count(*)::int as count from communities"),
      pool.query(`
        select count(*)::int as count
        from resource_providers
        where source = 'cfc_active'
          and source_ref = 'cfc_active:st-kilian-farmingdale'
          and status = 'active'
      `),
      pool.query("select count(*)::int as count from conversations"),
      pool.query("select count(*)::int as count from anchor_invites where anchor_invite_id = $1", [seedIds.anchorInviteId]),
      pool.query("select count(*)::int as count from community_rulesets where ruleset_id = $1", [seedIds.rulesetId]),
      pool.query("select count(*)::int as count from announcements where announcement_id = $1", [seedIds.announcementId]),
      pool.query("select count(*)::int as count from reports where report_id = $1 and status = 'new'", [seedIds.reportId])
    ]);

    expect(communities.rows[0].count).toBeGreaterThanOrEqual(1);
    expect(activeResources.rows[0].count).toBe(1);
    expect(conversations.rows[0].count).toBeGreaterThanOrEqual(1);
    expect(anchorInvites.rows[0].count).toBe(1);
    expect(rulesets.rows[0].count).toBe(1);
    expect(announcements.rows[0].count).toBe(1);
    expect(pendingReports.rows[0].count).toBe(1);
  });

  it("upserts seeded dataset versions on the natural source/version key", async () => {
    await runMigrations();

    await pool.query(
      `
        delete from resource_change_logs
        where source = 'cfc_active' and dataset_version = $1;
      `,
      [seedValues.datasetVersion]
    );

    await pool.query(
      `
        delete from verification_logs
        where provider_id in (
          select provider_id
          from resource_providers
          where source = 'cfc_active' and dataset_version = $1
        );
      `,
      [seedValues.datasetVersion]
    );

    await pool.query(
      `
        delete from resource_providers
        where source = 'cfc_active' and dataset_version = $1;
      `,
      [seedValues.datasetVersion]
    );

    await pool.query(
      `
        delete from dataset_versions
        where source = 'cfc_active' and dataset_version = $1;
      `,
      [seedValues.datasetVersion]
    );

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
          $1,
          'Old Source Label',
          'https://example.com/old-cfc',
          99,
          50,
          'failed',
          'old-checksum',
          '2026-01-01T00:00:00Z',
          '2026-01-01T01:00:00Z',
          now(),
          now()
        )
        on conflict do nothing;
      `,
      [seedValues.datasetVersion]
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
        where source = 'cfc_active' and dataset_version = $1
      `,
      [seedValues.datasetVersion]
    );

    expect(seededRow.rowCount).toBe(1);
    expect(seededRow.rows[0]).toMatchObject({
      dataset_version_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source_label: seedValues.datasetSourceLabel,
      source_url: seedValues.datasetSourceUrl,
      record_count: 1,
      status: "active",
      checksum: seedValues.datasetChecksum
    });
  });

  it("seeds M5 anchor-admin fixtures with canonical values", async () => {
    await runMigrations();
    await runSeed();

    const [anchorRow, inviteRow, rulesetRow, announcementRow, reportRow] = await Promise.all([
      pool.query(
        `
          select user_id, status, totp_secret_ciphertext, activated_at
          from anchors
          where anchor_id = $1
        `,
        [seedIds.anchorId]
      ),
      pool.query(
        `
          select code_hash, status
          from anchor_invites
          where anchor_invite_id = $1
        `,
        [seedIds.anchorInviteId]
      ),
      pool.query(
        `
          select review_categories, auto_hide_report_threshold, keyword_blocklist, announcement_pin_strategy
          from community_rulesets
          where ruleset_id = $1
        `,
        [seedIds.rulesetId]
      ),
      pool.query(
        `
          select title, is_pinned, status
          from announcements
          where announcement_id = $1
        `,
        [seedIds.announcementId]
      ),
      pool.query(
        `
          select target_type, target_id, status, conversation_id
          from reports
          where report_id = $1
        `,
        [seedIds.reportId]
      )
    ]);

    expect(anchorRow.rows[0]).toMatchObject({
      user_id: seedIds.anchorUserId,
      status: "active",
      totp_secret_ciphertext: seedValues.anchorTotpSecretCiphertext
    });
    expect(inviteRow.rows[0]).toMatchObject({
      code_hash: seedValues.anchorInviteCodeHash,
      status: "active"
    });
    expect(rulesetRow.rows[0]).toMatchObject({
      review_categories: ["transportation"],
      auto_hide_report_threshold: 2,
      keyword_blocklist: ["cash only"],
      announcement_pin_strategy: "manual"
    });
    expect(announcementRow.rows[0]).toMatchObject({
      title: seedValues.announcementTitle,
      is_pinned: true,
      status: "active"
    });
    expect(reportRow.rows[0]).toMatchObject({
      target_type: "post",
      target_id: seedIds.offerPostId,
      status: "new",
      conversation_id: seedIds.conversationId
    });
  });

  it("rejects invalid community ruleset enums at the DB layer", async () => {
    await runMigrations();

    await pool.query(
      `
        insert into communities (community_id, name, center_zip, join_policy)
        values ('99999999-9999-4999-8999-999999999999', 'Constraint Test Community', '11735', 'invite_only')
        on conflict (community_id) do nothing;
      `
    );

    await expect(
      pool.query(
        `
          insert into community_rulesets (
            ruleset_id,
            community_id,
            review_categories,
            auto_hide_report_threshold,
            keyword_blocklist,
            language_preferences,
            announcement_pin_strategy
          )
          values (
            'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            '99999999-9999-4999-8999-999999999999',
            ARRAY['food', 'not-a-real-category']::text[],
            3,
            ARRAY[]::text[],
            ARRAY['en', 'not-a-real-language']::text[],
            'latest'
          );
        `
      )
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("removes deprecated in_review report status from the final schema", async () => {
    await runMigrations();

    const enumRows = await pool.query<{ enumlabel: string }>(
      `
        select enumlabel
        from pg_enum
        join pg_type on pg_type.oid = pg_enum.enumtypid
        where pg_type.typname = 'report_status'
        order by enumsortorder
      `
    );

    expect(enumRows.rows.map((row) => row.enumlabel)).toEqual(["new", "resolved", "dismissed"]);

    await expect(
      pool.query(
        `
          insert into reports (
            report_id,
            community_id,
            target_type,
            target_id,
            reason,
            reporter_user_id,
            status
          )
          values (
            '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a',
            $1,
            'post',
            $2,
            'other',
            $3,
            'in_review'
          )
        `,
        [seedIds.communityId, seedIds.offerPostId, seedIds.anchorUserId]
      )
    ).rejects.toThrow();
  });
});
