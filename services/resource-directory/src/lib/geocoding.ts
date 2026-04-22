import type { GeocodeResult } from '../types.js';

export interface Geocoder {
  geocodeAddress(address: string, zip: string): Promise<GeocodeResult>;
  geocodeZip(zip: string): Promise<GeocodeResult>;
}

/**
 * V2-A DB-backed centroid lookup. Minimal DB-client surface — we accept any
 * object with a `query` method (pg.Pool / pg.Client both satisfy this) so
 * the resource-directory doesn't pick up a hard dependency on `pg` from this
 * module and tests can pass a stub. Returns `null` when the ZIP is not in
 * the lookup table, letting the caller fall through to the next tier.
 */
export interface NycZipCentroidReader {
  query<Row>(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

interface NycZipCentroidRow {
  lat: number | string;
  lng: number | string;
}

interface NominatimSearchResult {
  lat?: string;
  lon?: string;
}

export class NominatimGeocoder implements Geocoder {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly userAgent = 'WeaveNYC/0.1 (resource-directory)',
    /**
     * V2-A — optional DB client. When supplied, `geocodeZip` runs a
     * `SELECT lat, lng FROM nyc_zip_centroids WHERE zip = $1` FIRST. Misses
     * fall through to the in-memory table, then Nominatim. When omitted the
     * geocoder preserves its pre-V2-A behavior. Kept optional so tests that
     * don't need a DB can construct the geocoder with zero arguments.
     */
    private readonly centroidReader: NycZipCentroidReader | null = null
  ) {}

  async geocodeAddress(address: string, zip: string): Promise<GeocodeResult> {
    const exact = await this.lookup(
      new URLSearchParams({
        q: `${address}, ${zip}, NY, USA`,
        format: 'jsonv2',
        limit: '1'
      }),
      'street'
    );

    if (exact.lat !== null && exact.lng !== null) {
      return exact;
    }

    return this.geocodeZip(zip);
  }

  async geocodeZip(zip: string): Promise<GeocodeResult> {
    // Tier 1 — DB-backed NYC (+ commonly-requested Long Island) centroids.
    // This is the V2-A fix for the "Midtown/Bushwick/Williamsburg ZIPs
    // return zero" bug: previously every NYC ZIP fell through to Nominatim
    // which is rate-limited and frequently times out.
    if (this.centroidReader) {
      try {
        const result = await this.centroidReader.query<NycZipCentroidRow>(
          'select lat, lng from nyc_zip_centroids where zip = $1 limit 1',
          [zip],
        );
        const row = result.rows[0];
        if (row && row.lat !== null && row.lng !== null) {
          const lat = typeof row.lat === 'number' ? row.lat : Number(row.lat);
          const lng = typeof row.lng === 'number' ? row.lng : Number(row.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return { lat, lng, geoPrecision: 'zip_centroid' };
          }
        }
      } catch {
        // DB blip shouldn't take the whole request down — swallow and keep
        // falling through to the in-memory table / Nominatim tiers below.
      }
    }

    // Tier 2 — in-memory hard-coded Long Island centroids (pre-V2-A behavior).
    const known = zipCentroidTable[zip];
    if (known) {
      return {
        lat: known.lat,
        lng: known.lng,
        geoPrecision: 'zip_centroid'
      };
    }

    // Tier 3 — Nominatim. Rate-limited + flaky, but the right fallback for
    // ZIPs we haven't pre-computed (e.g. a user two states over).
    return this.lookup(
      new URLSearchParams({
        postalcode: zip,
        country: 'United States',
        format: 'jsonv2',
        limit: '1'
      }),
      'zip_centroid'
    );
  }

  private async lookup(params: URLSearchParams, geoPrecision: GeocodeResult['geoPrecision']) {
    let response: Response;
    try {
      response = await this.fetchImpl(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          'user-agent': this.userAgent,
          accept: 'application/json'
        }
      });
    } catch {
      return {
        lat: null,
        lng: null,
        geoPrecision: 'unknown'
      } satisfies GeocodeResult;
    }

    if (!response.ok) {
      return {
        lat: null,
        lng: null,
        geoPrecision: 'unknown'
      } satisfies GeocodeResult;
    }

    const payload = (await response.json()) as NominatimSearchResult[];
    const match = payload[0];
    if (!match?.lat || !match?.lon) {
      return {
        lat: null,
        lng: null,
        geoPrecision: 'unknown'
      } satisfies GeocodeResult;
    }

    return {
      lat: Number(match.lat),
      lng: Number(match.lon),
      geoPrecision
    } satisfies GeocodeResult;
  }
}

export class StubGeocoder implements Geocoder {
  constructor(private readonly table: Record<string, GeocodeResult>) {}

  async geocodeAddress(address: string, zip: string): Promise<GeocodeResult> {
    return (
      this.table[`${address}|${zip}`] ?? {
        lat: null,
        lng: null,
        geoPrecision: 'unknown'
      }
    );
  }

  async geocodeZip(zip: string): Promise<GeocodeResult> {
    return (
      this.table[`zip:${zip}`] ??
      zipCentroidTable[zip] ?? {
        lat: null,
        lng: null,
        geoPrecision: "unknown"
      }
    );
  }
}

export const zipCentroidTable: Record<string, GeocodeResult> = {
  "11735": { lat: 40.7326, lng: -73.4454, geoPrecision: "zip_centroid" },
  "11714": { lat: 40.7443, lng: -73.4821, geoPrecision: "zip_centroid" },
  "11758": { lat: 40.6807, lng: -73.4576, geoPrecision: "zip_centroid" },
  "11701": { lat: 40.6785, lng: -73.414, geoPrecision: "zip_centroid" },
  "11726": { lat: 40.6737, lng: -73.3958, geoPrecision: "zip_centroid" },
  "11798": { lat: 40.7562, lng: -73.36, geoPrecision: "zip_centroid" },
  "11756": { lat: 40.7259, lng: -73.5143, geoPrecision: "zip_centroid" }
};
