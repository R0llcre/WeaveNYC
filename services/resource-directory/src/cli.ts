import process from 'node:process';

import { Pool } from 'pg';

import { assertCfcCompleteness, inspectCfcActiveRecords } from './adapters/cfc-active.js';
import { loadIslandHarvestRecords } from './adapters/island-harvest.js';
import { importCfcActiveDataset, importIslandHarvestDataset } from './importers.js';

function getDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL ?? 'postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev';
  return connectionString;
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

async function main() {
  const [, , command, ...rest] = process.argv;
  const mode = getMode(rest);
  const force = isForce(rest);

  if (isSmoke(rest)) {
    await runSmoke(command ?? '', mode);
    return;
  }

  const pool = new Pool({
    connectionString: getDatabaseUrl()
  });

  try {
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
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
