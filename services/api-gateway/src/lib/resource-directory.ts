import { Pool } from "pg";

import {
  NominatimGeocoder,
  ResourceQueryRepository,
  type ResourceListItem,
  type ResourceSearchInput,
  type ResourceSearchResult
} from "@weavenyc/resource-directory";

export interface ResourceDirectoryService {
  searchResources(input: ResourceSearchInput): Promise<ResourceSearchResult>;
  getResourceDetail(providerId: string, zip?: string): Promise<ResourceListItem | null>;
  close(): Promise<void>;
}

export class PgResourceDirectoryService implements ResourceDirectoryService {
  private readonly repository: ResourceQueryRepository;
  private readonly geocoder: NominatimGeocoder;

  constructor(private readonly pool: Pool) {
    this.repository = new ResourceQueryRepository(pool);
    // V2-A — NominatimGeocoder accepts an optional centroid reader. Passing
    // `pool` routes NYC-ZIP geocodes through `nyc_zip_centroids` first; the
    // in-memory Long Island table + Nominatim remain as the 2nd/3rd tiers.
    this.geocoder = new NominatimGeocoder(fetch, undefined, pool);
  }

  async searchResources(input: ResourceSearchInput): Promise<ResourceSearchResult> {
    const zipCenter = await this.geocoder.geocodeZip(input.zip);
    const result = await this.repository.searchResources(input, zipCenter);
    // A5 P0 bonus — when the ZIP parsed but the geocoder couldn't resolve
    // it (e.g. a valid 5-digit code with no Nominatim entry), the radius
    // filter collapses to "zip string exact match". Only surface the empty-
    // state signal when the exact-match also returned nothing. If rows were
    // found via the fallback, those are still useful and the client should
    // render them instead of an empty state. 2026-04-21 fix: previously we
    // set this flag on every geocoder miss, which hid legitimate results
    // for any ZIP Nominatim was temporarily slow/down on.
    if ((zipCenter.lat === null || zipCenter.lng === null) && result.items.length === 0) {
      return { ...result, noResultsInArea: true };
    }
    return result;
  }

  async getResourceDetail(providerId: string, zip?: string): Promise<ResourceListItem | null> {
    const zipCenter = zip ? await this.geocoder.geocodeZip(zip) : { lat: null, lng: null };
    return this.repository.getResourceDetail(providerId, zipCenter);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPgResourceDirectoryService(connectionString: string) {
  return new PgResourceDirectoryService(
    new Pool({
      connectionString
    })
  );
}
