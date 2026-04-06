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
    this.geocoder = new NominatimGeocoder();
  }

  async searchResources(input: ResourceSearchInput): Promise<ResourceSearchResult> {
    const zipCenter = await this.geocoder.geocodeZip(input.zip);
    return this.repository.searchResources(input, zipCenter);
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
