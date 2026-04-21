/**
 * db:migrate:rollback — revert the most recently applied migration.
 *
 * Background (A8 P0-4): docs/29_M8_Pilot_Readiness.md §3.7 referenced
 * `pnpm db:migrate:rollback --env production` but no implementation
 * existed. The pilot rollback SOP cannot be exercised without this
 * command, so the gate was failing.
 *
 * Contract (intentionally minimal — pilot-scope, single-step rollback):
 *
 * 1. Determine the last applied migration from the `schema_migrations`
 *    tracking table (ordered by `applied_at DESC`). `runMigrations`
 *    in ./migrate.ts created this table with columns
 *    `(filename, checksum, applied_at)`.
 * 2. Look for a paired down file at `../migrations/<filename>.rollback.sql`
 *    — e.g. `0014_idempotency_keys.sql` pairs with
 *    `0014_idempotency_keys.rollback.sql`.
 * 3. If the paired file exists: execute it inside a single transaction,
 *    then DELETE the row from `schema_migrations` so the next
 *    `db:migrate` run would re-apply the forward migration.
 * 4. If the paired file does NOT exist: FAIL LOUD. Print the exact
 *    recovery advice ("no rollback migration — take a pg_dump before
 *    applying <filename>") and exit non-zero. This is deliberate: we'd
 *    rather surface the absence than silently no-op and give operators
 *    a false sense of safety.
 *
 * Usage (from repo root):
 *   pnpm db:migrate:rollback
 *   DATABASE_URL=postgres://... pnpm db:migrate:rollback
 *
 * `--env production` is accepted and ignored — the DATABASE_URL env var
 * is the authoritative source. The flag exists so the command shape in
 * the Rollback SOP (docs/29_M8_Pilot_Readiness.md §3.7) stays readable.
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

import { getDbEnv } from "../src/env";

const scriptDir = __dirname;
const migrationsDir = path.resolve(scriptDir, "../migrations");

type LastMigrationRow = {
  filename: string;
  applied_at: string;
};

export async function runRollback(): Promise<void> {
  const pool = new Pool({
    connectionString: getDbEnv().databaseUrl,
  });

  try {
    // Ensure the tracking table exists — if migrations were never run
    // this command has nothing to do and should exit gracefully.
    const hasTable = await pool.query<{ exists: boolean }>(
      "select exists(select 1 from information_schema.tables where table_name = 'schema_migrations') as exists",
    );
    if (hasTable.rows[0]?.exists !== true) {
      console.error(
        "[rollback] schema_migrations table does not exist — no migrations have been applied. Nothing to roll back.",
      );
      process.exitCode = 1;
      return;
    }

    const latest = await pool.query<LastMigrationRow>(
      "select filename, applied_at::text as applied_at from schema_migrations order by applied_at desc, filename desc limit 1",
    );
    if (latest.rowCount === 0) {
      console.error(
        "[rollback] schema_migrations is empty — nothing to roll back.",
      );
      process.exitCode = 1;
      return;
    }

    const { filename, applied_at } = latest.rows[0]!;
    const rollbackFilename = filename.replace(/\.sql$/i, ".rollback.sql");
    const rollbackPath = path.join(migrationsDir, rollbackFilename);

    console.log(
      `[rollback] last applied migration: ${filename} (applied_at=${applied_at})`,
    );
    console.log(`[rollback] looking for down file: ${rollbackFilename}`);

    let rollbackSql: string;
    try {
      await stat(rollbackPath);
      rollbackSql = await readFile(rollbackPath, "utf8");
    } catch {
      console.error(
        `[rollback] FAIL: no rollback migration for ${filename}. ` +
          `Take a pg_dump before applying ${filename} and restore from it instead. ` +
          `See docs/11_Ops_Runbook.md §D.4 for the restore command, and ` +
          `docs/29_M8_Pilot_Readiness.md §3.7 for the rollback SOP.`,
      );
      process.exitCode = 1;
      return;
    }

    if (rollbackSql.trim().length === 0) {
      console.error(
        `[rollback] FAIL: ${rollbackFilename} exists but is empty. ` +
          `Populate the file with inverse DDL or take a pg_dump before ${filename} and restore.`,
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      `[rollback] applying ${rollbackFilename} and deleting schema_migrations row for ${filename}`,
    );

    await pool.query("begin");
    try {
      await pool.query(rollbackSql);
      await pool.query(
        "delete from schema_migrations where filename = $1",
        [filename],
      );
      await pool.query("commit");
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }

    console.log(`[rollback] OK: ${filename} rolled back.`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void runRollback().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
