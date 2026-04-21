import { Pool } from 'pg';

import { loadCfcActiveRecords, cfcActiveSourceUrl } from './adapters/cfc-active.js';
import { loadIslandHarvestRecords, islandHarvestSourceUrl } from './adapters/island-harvest.js';
import { NominatimGeocoder, type Geocoder } from './lib/geocoding.js';
import { ResourceImportRepository, type ImportDatasetOptions } from './lib/repository.js';
import type { DatasetImportSummary, ImportOptions, NormalizedResourceRecord, ResourceSource } from './types.js';

async function enrichWithGeocodes(records: NormalizedResourceRecord[], geocoder: Geocoder) {
  const enriched: NormalizedResourceRecord[] = [];

  for (const record of records) {
    if (record.lat !== null && record.lng !== null) {
      enriched.push(record);
      continue;
    }

    const geocode = await geocoder.geocodeAddress(record.addressText, record.zip);
    enriched.push({
      ...record,
      lat: geocode.lat,
      lng: geocode.lng,
      geoPrecision: geocode.geoPrecision
    });
  }

  return enriched;
}

function buildDatasetVersion(source: ResourceSource, explicitVersion?: string): string {
  if (explicitVersion) {
    return explicitVersion;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${source}_${stamp}`;
}

export async function importCfcActiveDataset(
  pool: Pool,
  options: ImportOptions & ImportDatasetOptions = {},
  geocoder: Geocoder = new NominatimGeocoder()
): Promise<DatasetImportSummary> {
  const records = await enrichWithGeocodes(await loadCfcActiveRecords(options), geocoder);
  const repo = new ResourceImportRepository(pool);
  return repo.importDataset(
    {
      source: 'cfc_active',
      sourceLabel: 'NYC HRA Community Food Connection',
      sourceUrl: cfcActiveSourceUrl,
      datasetVersion: buildDatasetVersion('cfc_active', options.datasetVersion),
      records,
    },
    { force: options.force, minRecordFraction: options.minRecordFraction },
  );
}

export async function importIslandHarvestDataset(
  pool: Pool,
  options: ImportOptions & ImportDatasetOptions = {},
  geocoder: Geocoder = new NominatimGeocoder()
): Promise<DatasetImportSummary> {
  const records = await enrichWithGeocodes(await loadIslandHarvestRecords(options), geocoder);
  const repo = new ResourceImportRepository(pool);
  return repo.importDataset(
    {
      source: 'island_harvest',
      sourceLabel: 'Island Harvest Pantry Finder',
      sourceUrl: islandHarvestSourceUrl,
      datasetVersion: buildDatasetVersion('island_harvest', options.datasetVersion),
      records,
    },
    { force: options.force, minRecordFraction: options.minRecordFraction },
  );
}
