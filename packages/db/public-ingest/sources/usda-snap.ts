import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createRateLimiter, fetchWithRetry } from "../http";
import { assertNoPersonPii } from "../pii";
import type {
  FetchOptions,
  PublicSourceModule,
  ResourceProviderSeed,
  SourceAttribution,
} from "../types";

const SOURCE_ID = "usda_snap";
const SOURCE_LABEL = "USDA FNS SNAP Retailer Locator";
const SOURCE_URL = "https://usda-fns.maps.arcgis.com/apps/webappviewer/index.html?id=b41c1aaadbb44ea986cc8eeaa19e3f2f";
// Public ArcGIS FeatureServer for the SNAP Retailer Locator dataset.
const ARCGIS_QUERY_URL =
  "https://services1.arcgis.com/RLQu0rK7h4kbsBq5/ArcGIS/rest/services/Store_Locations/FeatureServer/0/query?where=State%3D%27NY%27&outFields=*&f=json&resultRecordCount=2000";
const FIXTURE_PATH = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "usda-snap-ny.raw.sample.json"
);

function currentDatasetVersion(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${SOURCE_ID}_${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

const rateLimiter = createRateLimiter({ rps: 2, burst: 2 });

export interface UsdaSnapAttributes {
  OBJECTID?: number;
  Store_Name?: string;
  Address?: string;
  Address_Line__2?: string;
  City?: string;
  State?: string;
  Zip5?: string | number;
  Zip4?: string | number;
  County?: string;
  Latitude?: number;
  Longitude?: number;
}

export interface UsdaSnapFeature {
  attributes: UsdaSnapAttributes;
  geometry?: { x?: number; y?: number };
}

export interface UsdaSnapRaw {
  features?: UsdaSnapFeature[];
}

function hashContent(row: ResourceProviderSeed): string {
  const payload = JSON.stringify({
    source: row.source,
    sourceRef: row.sourceRef,
    name: row.name,
    addressText: row.addressText,
    zip: row.zip,
    lat: row.lat,
    lng: row.lng,
  });
  return createHash("sha256").update(payload).digest("hex");
}

async function readFixture(): Promise<UsdaSnapFeature[]> {
  const text = await readFile(FIXTURE_PATH, "utf8");
  const parsed = JSON.parse(text) as UsdaSnapRaw | UsdaSnapFeature[];
  if (Array.isArray(parsed)) return parsed;
  return parsed.features ?? [];
}

async function fetchLive(opts?: FetchOptions): Promise<UsdaSnapFeature[]> {
  await rateLimiter();
  const response = await fetchWithRetry(ARCGIS_QUERY_URL, {
    signal: opts?.signal,
    accept: "application/json",
  });
  if (!response.ok) {
    throw new Error(`usda_snap HTTP ${response.status}`);
  }
  const json = (await response.json()) as UsdaSnapRaw;
  return json.features ?? [];
}

export const usdaSnap: PublicSourceModule<UsdaSnapFeature> = {
  id: SOURCE_ID,
  sourceLabel: SOURCE_LABEL,
  sourceUrl: SOURCE_URL,
  rateLimit: { rps: 2, burst: 2 },

  async fetch(opts: FetchOptions = {}): Promise<UsdaSnapFeature[]> {
    if (opts.fromCache) {
      return readFixture();
    }
    try {
      return await fetchLive(opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[${SOURCE_ID}] live fetch failed (${message}); falling back to fixture\n`
      );
      return readFixture();
    }
  },

  normalize(raw: UsdaSnapFeature[]): ResourceProviderSeed[] {
    const datasetVersion = currentDatasetVersion();
    const out: ResourceProviderSeed[] = [];
    for (const feature of raw) {
      const attrs = feature.attributes ?? {};
      const name = attrs.Store_Name?.trim();
      const zip = String(attrs.Zip5 ?? "").padStart(5, "0").slice(0, 5);
      const address = attrs.Address?.trim() ?? "";
      if (!name || !zip || !address) continue;
      const lat = attrs.Latitude ?? feature.geometry?.y ?? null;
      const lng = attrs.Longitude ?? feature.geometry?.x ?? null;
      const city = attrs.City?.trim() ?? null;
      const seed: ResourceProviderSeed = {
        source: SOURCE_ID,
        sourceRef: `${SOURCE_ID}:${attrs.OBJECTID ?? `${name}-${zip}`}`,
        name,
        type: "snap_retailer",
        addressText: `${address}${city ? `, ${city}` : ""}, NY ${zip}`,
        city,
        state: "NY",
        zip,
        phone: null,
        hoursJson: null,
        languages: null,
        eligibilityNotes: "Authorized SNAP/EBT retailer. Accepts SNAP benefits at checkout.",
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
        geoPrecision: lat && lng ? "street" : "zip_centroid",
        contentHash: "",
        datasetVersion,
        sourceLabel: SOURCE_LABEL,
        sourceUrl: SOURCE_URL,
      };
      seed.contentHash = hashContent(seed);
      out.push(seed);
    }
    return out;
  },

  attribution(): SourceAttribution {
    return {
      sourceLabel: SOURCE_LABEL,
      sourceUrl: SOURCE_URL,
      datasetVersion: currentDatasetVersion(),
    };
  },

  pii(row: ResourceProviderSeed): void {
    assertNoPersonPii(row);
  },
};
