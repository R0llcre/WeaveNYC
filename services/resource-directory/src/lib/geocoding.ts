import type { GeocodeResult } from '../types.js';

export interface Geocoder {
  geocodeAddress(address: string, zip: string): Promise<GeocodeResult>;
  geocodeZip(zip: string): Promise<GeocodeResult>;
}

interface NominatimSearchResult {
  lat?: string;
  lon?: string;
}

export class NominatimGeocoder implements Geocoder {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly userAgent = 'WeaveNYC/0.1 (resource-directory)'
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
    const known = zipCentroidTable[zip];
    if (known) {
      return {
        lat: known.lat,
        lng: known.lng,
        geoPrecision: "zip_centroid"
      };
    }

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
