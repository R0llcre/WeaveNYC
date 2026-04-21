/**
 * Shared types for the public-data ingest pipeline.
 *
 * Shape MUST stay aligned with the `resource_providers` columns declared in
 * `packages/db/migrations/0000_m0_initial.sql`. The M0 schema is the canonical
 * contract — this module only massages public datasets into rows the existing
 * seed/upsert path can consume without changes.
 */

export type GeoPrecision = "street" | "zip_centroid" | "city";

export type ResourceProviderType =
  | "pantry"
  | "soup_kitchen"
  | "mobile_pantry"
  | "snap_retailer"
  | "senior_meal_site"
  | "community_fridge"
  | "fqhc";

/**
 * Row shape emitted by every public-ingest source module. Columns correspond
 * 1:1 with `resource_providers` in M0, plus two orchestration fields
 * (`sourceLabel`, `sourceUrl`) that the seed layer records on the per-source
 * `dataset_versions` row.
 */
export interface ResourceProviderSeed {
  source: string;
  sourceRef: string;
  name: string;
  type: ResourceProviderType;
  addressText: string;
  city?: string | null;
  state?: string | null;
  zip: string;
  phone?: string | null;
  hoursJson?: Record<string, unknown> | null;
  languages?: string[] | null;
  eligibilityNotes?: string | null;
  lat?: number | null;
  lng?: number | null;
  geoPrecision: GeoPrecision;
  contentHash: string;
  datasetVersion: string;
  sourceLabel: string;
  sourceUrl: string;
}

export interface RateLimit {
  /** Requests per second ceiling enforced per source. */
  rps: number;
  /** Burst allowance before rps throttling engages. */
  burst: number;
}

export interface SourceAttribution {
  sourceLabel: string;
  sourceUrl: string;
  datasetVersion: string;
}

export interface FetchOptions {
  /** When true, the source MUST read from its checked-in fixture and never hit the network. */
  fromCache?: boolean;
  /** AbortSignal forwarded to any underlying fetch. */
  signal?: AbortSignal;
}

export interface PublicSourceModule<Raw = unknown> {
  id: string;
  sourceLabel: string;
  sourceUrl: string;
  rateLimit: RateLimit;
  fetch(opts?: FetchOptions): Promise<Raw[]>;
  normalize(raw: Raw[]): ResourceProviderSeed[];
  attribution(): SourceAttribution;
  /** Throws on any detected person-level PII. Called on every normalized row. */
  pii(row: ResourceProviderSeed): void;
}

export interface IngestOptions {
  dryRun?: boolean;
  outputPath?: string;
  include?: string[];
  exclude?: string[];
  fromCache?: boolean;
}

export interface SourceIngestSummary {
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
  datasetVersion: string;
  rowCount: number;
  uniqueAfterDedup: number;
}

export interface IngestResult {
  generatedAt: string;
  totalRows: number;
  uniqueRows: number;
  sources: SourceIngestSummary[];
  rows: ResourceProviderSeed[];
}
