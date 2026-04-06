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
  /Connection refused/i,
  /timeout expired/i,
  /could not connect/i
];

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
      .filter((entry) => entry.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));

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
