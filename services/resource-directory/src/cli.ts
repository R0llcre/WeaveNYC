import process from 'node:process';
import { readFileSync } from 'node:fs';

import { Pool, type PoolClient, type PoolConfig } from 'pg';

import { assertCfcCompleteness, inspectCfcActiveRecords } from './adapters/cfc-active.js';
import { loadIslandHarvestRecords } from './adapters/island-harvest.js';
import { importCfcActiveDataset, importIslandHarvestDataset } from './importers.js';

function getDatabaseConfig(): PoolConfig {
  const connectionTimeoutMillis = 10_000;
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, connectionTimeoutMillis };
  }

  // ECS injects the existing RDS password via a Secrets Manager reference.
  // Keep it separate from the non-secret connection fields so the task
  // definition, deployment API, and logs never contain a raw DSN.
  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, PGSSLROOTCERT } = process.env;
  if (PGHOST || PGPORT || PGUSER || PGPASSWORD || PGDATABASE || process.env.NODE_ENV === 'production') {
    if (!PGHOST || !PGUSER || !PGPASSWORD || !PGDATABASE || !PGSSLROOTCERT) {
      throw new Error('Import database configuration is incomplete');
    }
    const port = Number(PGPORT ?? '5432');
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Import database port is invalid');
    }
    return {
      host: PGHOST,
      port,
      user: PGUSER,
      password: PGPASSWORD,
      database: PGDATABASE,
      ssl: { ca: readFileSync(PGSSLROOTCERT, 'utf8'), rejectUnauthorized: true },
      connectionTimeoutMillis,
    };
  }

  return {
    connectionString: 'postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev',
    connectionTimeoutMillis,
  };
}

function getMode(argv: string[]): 'live' | 'fixture' {
  return argv.includes('--fixture') ? 'fixture' : 'live';
}

function isSmoke(argv: string[]): boolean {
  return argv.includes('--smoke');
}

// A5 P0.2 — `--force` bypasses the import completeness guard in
// ResourceImportRepository.importDataset. Used when a source legitimately
// shrinks (e.g. from 500 pantries to 10) so we don't get wedged.
function isForce(argv: string[]): boolean {
  return argv.includes('--force');
}

async function runSmoke(command: string, mode: 'live' | 'fixture') {
  if (command === 'cfc-active') {
    const result = await inspectCfcActiveRecords({ mode });
    if (mode === 'live') {
      assertCfcCompleteness(result);
    }
    if (result.records.length === 0) {
      throw new Error('CFC Active smoke check returned zero records');
    }
    console.log({
      source: 'cfc_active',
      mode,
      recordCount: result.records.length,
      headerCount: result.diagnostics.headerCount,
      skippedCount: result.diagnostics.skippedCount,
      sample: result.records.slice(0, 3).map((record) => ({
        sourceRef: record.sourceRef,
        name: record.name,
        zip: record.zip
      }))
    });
    return;
  }

  if (command === 'island-harvest') {
    const records = await loadIslandHarvestRecords({ mode });
    if (records.length === 0) {
      throw new Error('Island Harvest smoke check returned zero records');
    }
    console.log({
      source: 'island_harvest',
      mode,
      recordCount: records.length,
      sample: records.slice(0, 3).map((record) => ({
        sourceRef: record.sourceRef,
        name: record.name,
        zip: record.zip
      }))
    });
    return;
  }

  if (command === 'sync') {
    await runSmoke('cfc-active', mode);
    await runSmoke('island-harvest', mode);
    return;
  }

  throw new Error(`Unknown command: ${command ?? '<none>'}`);
}

async function runDatabasePreflight(pool: Pool, mode: 'live' | 'fixture') {
  const expectedDatabase = process.env.RESOURCE_IMPORT_EXPECTED_DATABASE;
  if (process.env.PGHOST && !expectedDatabase) {
    throw new Error('Import expected database name is required');
  }
  const identity = await pool.query<{ database: string }>('select current_database() as database');
  if (expectedDatabase && identity.rows[0]?.database !== expectedDatabase) {
    throw new Error('Import database target does not match the approved database');
  }

  const schema = await pool.query<{
    providers: string | null;
    versions: string | null;
    changes: string | null;
    centroids: string | null;
  }>(`select
       to_regclass('public.resource_providers')::text as providers,
       to_regclass('public.dataset_versions')::text as versions,
       to_regclass('public.resource_change_logs')::text as changes,
       to_regclass('public.nyc_zip_centroids')::text as centroids`);
  if (Object.values(schema.rows[0] ?? {}).some((table) => !table)) {
    throw new Error('Import schema is incomplete; no resource data was changed');
  }
  const centroidResult = await pool.query<{ count: string }>('select count(*)::text as count from nyc_zip_centroids');
  const centroidCount = Number(centroidResult.rows[0]?.count ?? 0);
  if (centroidCount < 100) {
    throw new Error(`ZIP centroid cache has only ${centroidCount} rows; no resource data was changed`);
  }

  const cfc = await inspectCfcActiveRecords({ mode });
  if (mode === 'live') assertCfcCompleteness(cfc);
  const island = await loadIslandHarvestRecords({ mode });
  for (const [source, records] of [
    ['cfc_active', cfc.records],
    ['island_harvest', island],
  ] as const) {
    if (records.length === 0 || new Set(records.map((record) => record.sourceRef)).size !== records.length) {
      throw new Error(`Import source ${source} is empty or contains duplicate references`);
    }
    const previous = await pool.query<{ source_ref: string }>(
      `select source_ref from resource_providers where source = $1 and status = 'active'`,
      [source],
    );
    const isManaged = (ref: string) => source !== 'cfc_active' || /^cfc_active:[0-9]{5}$/.test(ref);
    const managed = previous.rows.filter((row) => isManaged(row.source_ref));
    const incoming = new Set(records.map((record) => record.sourceRef));
    const wouldInactivate = managed.filter((row) => !incoming.has(row.source_ref)).length;
    console.log({
      source,
      incomingCount: records.length,
      previouslyActiveManaged: managed.length,
      preservedCurated: previous.rows.length - managed.length,
      wouldInactivate,
    });
  }
  console.log({ approvedDatabaseMatched: true, centroidCount, writesPerformed: false });
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const mode = getMode(rest);
  const force = isForce(rest);

  if (isSmoke(rest)) {
    await runSmoke(command ?? '', mode);
    return;
  }

  const pool = new Pool(getDatabaseConfig());
  let lockClient: PoolClient | null = null;

  try {
    // Fail before any external geocoding when the configured database is unreachable.
    await pool.query('select 1');
    if (command === 'preflight') {
      await runDatabasePreflight(pool, mode);
      return;
    }
    if (command === 'sync') {
      // A task left running after a GitHub runner failure must not overlap a
      // later scheduled import. PostgreSQL releases this lock if the process
      // or its database session ends.
      lockClient = await pool.connect();
      const lock = await lockClient.query<{ acquired: boolean }>(
        'select pg_try_advisory_lock(7213463824169021::bigint) as acquired',
      );
      if (!lock.rows[0]?.acquired) {
        throw new Error('Another resource import is already running');
      }
    }
    if (command === 'sync' && process.env.RESOURCE_IMPORT_REQUIRE_PREFLIGHT === '1') {
      await runDatabasePreflight(pool, mode);
    }
    if (command === 'cfc-active') {
      console.log(await importCfcActiveDataset(pool, { mode, force }));
      return;
    }

    if (command === 'island-harvest') {
      console.log(await importIslandHarvestDataset(pool, { mode, force }));
      return;
    }

    if (command === 'sync') {
      console.log(await importCfcActiveDataset(pool, { mode, force }));
      console.log(await importIslandHarvestDataset(pool, { mode, force }));
      return;
    }

    throw new Error(`Unknown command: ${command ?? '<none>'}`);
  } finally {
    if (lockClient) {
      try {
        await lockClient.query('select pg_advisory_unlock(7213463824169021::bigint)');
      } finally {
        lockClient.release();
      }
    }
    await pool.end();
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = [process.env.PGPASSWORD, process.env.DATABASE_URL]
    .filter((secret): secret is string => Boolean(secret))
    .reduce((value, secret) => value.replaceAll(secret, '[redacted]'), message);
  console.error(redacted);
  process.exitCode = 1;
});
