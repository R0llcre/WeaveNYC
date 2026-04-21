import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

import { getDbEnv } from "../src/env";

const scriptDir = __dirname;
const migrationsDir = path.resolve(scriptDir, "../migrations");
const databaseReadyRetryableMessages = [
  /connection terminated unexpectedly/i,
  /database system is starting up/i,
  /the database system is starting up/i,
  /connect ECONNREFUSED/i,
  /read ECONNRESET/i,
  /ECONNRESET/i,
  /Connection refused/i,
  /timeout expired/i,
  /could not connect/i
];

/**
 * Reserved migration filename prefixes (F4-B fix #2).
 *
 * The migration history has gaps (0010 → 0013) because early M8 work
 * squashed 0011 and 0012 into 0010. The tracking table keys by filename
 * verbatim, so renaming applied rows is unsafe on prod. Instead we refuse
 * to apply any NEW migration whose filename starts with one of these
 * reserved prefixes — this stops a feature branch from silently landing
 * `0011_my_new_thing.sql` between 0010 and 0013 and reordering
 * dependencies.
 *
 * See packages/db/migrations/README.md for the full explanation and
 * instructions for recycling a reserved slot if it ever becomes necessary.
 */
const RESERVED_MIGRATION_PREFIXES = ["0011", "0012"] as const;

export async function runMigrations(): Promise<void> {
  const pool = new Pool({
    connectionString: getDbEnv().databaseUrl
  });

  try {
    await waitForDatabase(pool);
    await pool.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      );
    `);

    const files = (await readdir(migrationsDir))
      // Forward runner must NOT pick up `*.rollback.sql` paired down
      // migrations introduced by the db:migrate:rollback SOP (A8 P0-4).
      // Those run via scripts/rollback.ts only.
      .filter((entry) => entry.endsWith(".sql") && !entry.endsWith(".rollback.sql"))
      .sort((left, right) => left.localeCompare(right));

    // Reserved-prefix guard (F4-B fix #2). Refuse to apply any migration
    // whose 4-digit prefix is in RESERVED_MIGRATION_PREFIXES. This prevents
    // a feature branch from silently dropping 0011/0012 into the lexical
    // order between 0010 and 0013. Fails loud so the conflict is surfaced
    // at migrate-time, not at cascade-failure time weeks later.
    const reservedOffenders = files.filter((filename) =>
      RESERVED_MIGRATION_PREFIXES.some((prefix) => filename.startsWith(`${prefix}_`))
    );
    if (reservedOffenders.length > 0) {
      throw new Error(
        `Reserved migration prefix in use: ${reservedOffenders.join(", ")}. ` +
          `Prefixes ${RESERVED_MIGRATION_PREFIXES.join(", ")} are reserved — ` +
          `see packages/db/migrations/README.md.`
      );
    }

    for (const filename of files) {
      const absolutePath = path.join(migrationsDir, filename);
      const sql = await readFile(absolutePath, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await pool.query<{
        checksum: string;
      }>("select checksum from schema_migrations where filename = $1", [filename]);

      if (existing.rowCount === 1) {
        if (existing.rows[0]?.checksum !== checksum) {
          throw new Error(`Migration checksum drift detected for ${filename}`);
        }
        continue;
      }

      await pool.query("begin");

      try {
        await pool.query(sql);
        await pool.query(
          "insert into schema_migrations (filename, checksum) values ($1, $2)",
          [filename, checksum]
        );
        await pool.query("commit");
      } catch (error) {
        await pool.query("rollback");
        throw error;
      }
    }
  } finally {
    await pool.end();
  }
}

async function waitForDatabase(pool: Pool, attempts = 15, delayMs = 1000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (!isRetryableDatabaseError(error) || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function isRetryableDatabaseError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return databaseReadyRetryableMessages.some((pattern) => pattern.test(error.message));
}

if (require.main === module) {
  void runMigrations().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
