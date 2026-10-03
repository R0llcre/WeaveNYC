import { Pool } from 'pg';

import { loadCfcActiveRecords, cfcActiveSourceUrl } from './adapters/cfc-active.js';
import { loadIslandHarvestRecords, islandHarvestSourceUrl } from './adapters/island-harvest.js';
import { NominatimGeocoder, type Geocoder } from './lib/geocoding.js';
import { ResourceImportRepository, type ImportDatasetOptions } from './lib/repository.js';
import type { DatasetImportSummary, ImportOptions, NormalizedResourceRecord, ResourceSource } from './types.js';

type PriorGeocodeRow = {
  source_ref: string;
  address_text: string;
  zip: string;
  lat: number;
  lng: number;
  geo_precision: NormalizedResourceRecord['geoPrecision'];
};

async function enrichWithGeocodes(
  records: NormalizedResourceRecord[],
  geocoder: Geocoder,
  pool: Pool,
  source: ResourceSource,
) {
  // Keep precise coordinates for unchanged addresses on subsequent imports.
  const prior = await pool.query<PriorGeocodeRow>(
    `select source_ref, address_text, zip, lat, lng, geo_precision
       from resource_providers
       where source = $1 and status = 'active'
         and lat is not null and lng is not null`,
    [source],
  );
  const priorByRef = new Map(prior.rows.map((row) => [row.source_ref, row]));
  const zipCache = new Map<string, Awaited<ReturnType<Geocoder['geocodeZip']>>>();
  const enriched: NormalizedResourceRecord[] = [];

  for (const record of records) {
    if (record.lat !== null && record.lng !== null) {
      enriched.push(record);
      continue;
    }

    const previous = priorByRef.get(record.sourceRef);
    if (
      previous &&
      previous.zip === record.zip &&
      previous.address_text.trim().toLowerCase() === record.addressText.trim().toLowerCase()
    ) {
      enriched.push({
        ...record,
        lat: Number(previous.lat),
        lng: Number(previous.lng),
        geoPrecision: previous.geo_precision,
      });
      continue;
    }

    // Bulk refreshes need bounded work. NYC/LI ZIP centroids are seeded in
    // the staging DB; cache repeated ZIPs and only use Nominatim for misses.
    let geocode = zipCache.get(record.zip);
    if (!geocode) {
      geocode = await geocoder.geocodeZip(record.zip);
      zipCache.set(record.zip, geocode);
    }
    enriched.push({
      ...record,
      lat: geocode.lat,
      lng: geocode.lng,
      geoPrecision: geocode.geoPrecision,
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
  geocoder: Geocoder = new NominatimGeocoder(fetch, 'WeaveNYC/0.1 (resource-directory)', pool)
): Promise<DatasetImportSummary> {
  const records = await enrichWithGeocodes(await loadCfcActiveRecords(options), geocoder, pool, 'cfc_active');
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
  geocoder: Geocoder = new NominatimGeocoder(fetch, 'WeaveNYC/0.1 (resource-directory)', pool)
): Promise<DatasetImportSummary> {
  const records = await enrichWithGeocodes(await loadIslandHarvestRecords(options), geocoder, pool, 'island_harvest');
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
