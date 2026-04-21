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

const SOURCE_ID = "hrsa_fqhc";
const SOURCE_LABEL = "HRSA Find a Health Center";
const SOURCE_URL = "https://findahealthcenter.hrsa.gov/";
// HRSA publishes the Health Center Service Delivery Sites dataset via the
// Data Warehouse. We pull the NY slice filtered server-side. Kept as an ArcGIS
// REST query so the offline fixture shape matches the feature-server payload.
const ARCGIS_QUERY_URL =
  "https://services.arcgis.com/qWZ7BaZXaP5isnfT/arcgis/rest/services/HRSA_Health_Center_Service_Delivery_Sites/FeatureServer/0/query?where=State_Name%3D%27NY%27&outFields=*&f=json&resultRecordCount=2000";
const FIXTURE_PATH = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "hrsa-fqhc-ny.raw.sample.json"
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

const rateLimiter = createRateLimiter({ rps: 1, burst: 1 });

export interface HrsaFqhcAttributes {
  OBJECTID?: number;
  Site_ID?: string;
  Site_Name?: string;
  Site_Address?: string;
  Site_City?: string;
  Site_State_Abbreviation?: string;
  State_Name?: string;
  Site_Postal_Code?: string | number;
  Site_Telephone_Number?: string;
  Health_Center_Service_Delivery_Site_Location_Setting_Description?: string;
  Site_Operating_Hours_per_Week?: string;
  Latitude?: number;
  Longitude?: number;
}

export interface HrsaFqhcFeature {
  attributes: HrsaFqhcAttributes;
  geometry?: { x?: number; y?: number };
}

export interface HrsaFqhcRaw {
  features?: HrsaFqhcFeature[];
}

function hashContent(row: ResourceProviderSeed): string {
  const payload = JSON.stringify({
    source: row.source,
    sourceRef: row.sourceRef,
    name: row.name,
    addressText: row.addressText,
    zip: row.zip,
    phone: row.phone,
    lat: row.lat,
    lng: row.lng,
  });
  return createHash("sha256").update(payload).digest("hex");
}

async function readFixture(): Promise<HrsaFqhcFeature[]> {
  const text = await readFile(FIXTURE_PATH, "utf8");
  const parsed = JSON.parse(text) as HrsaFqhcRaw | HrsaFqhcFeature[];
  if (Array.isArray(parsed)) return parsed;
  return parsed.features ?? [];
}

async function fetchLive(opts?: FetchOptions): Promise<HrsaFqhcFeature[]> {
  await rateLimiter();
  const response = await fetchWithRetry(ARCGIS_QUERY_URL, {
    signal: opts?.signal,
    accept: "application/json",
  });
  if (!response.ok) {
    throw new Error(`hrsa_fqhc HTTP ${response.status}`);
  }
  const json = (await response.json()) as HrsaFqhcRaw;
  return json.features ?? [];
}

export const hrsaFqhc: PublicSourceModule<HrsaFqhcFeature> = {
  id: SOURCE_ID,
  sourceLabel: SOURCE_LABEL,
  sourceUrl: SOURCE_URL,
  rateLimit: { rps: 1, burst: 1 },

  async fetch(opts: FetchOptions = {}): Promise<HrsaFqhcFeature[]> {
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

  normalize(raw: HrsaFqhcFeature[]): ResourceProviderSeed[] {
    const datasetVersion = currentDatasetVersion();
    const out: ResourceProviderSeed[] = [];
    for (const feature of raw) {
      const attrs = feature.attributes ?? {};
      const name = attrs.Site_Name?.trim();
      const zip = String(attrs.Site_Postal_Code ?? "").slice(0, 5);
      const address = attrs.Site_Address?.trim() ?? "";
      if (!name || !zip || !address) continue;
      const stateCode = attrs.Site_State_Abbreviation ?? attrs.State_Name;
      if (stateCode && !/^(NY|New York)$/i.test(stateCode.trim())) continue;
      const lat = attrs.Latitude ?? feature.geometry?.y ?? null;
      const lng = attrs.Longitude ?? feature.geometry?.x ?? null;
      const city = attrs.Site_City?.trim() ?? null;
      const seed: ResourceProviderSeed = {
        source: SOURCE_ID,
        sourceRef: `${SOURCE_ID}:${attrs.Site_ID ?? attrs.OBJECTID ?? `${name}-${zip}`}`,
        name,
        type: "fqhc",
        addressText: `${address}${city ? `, ${city}` : ""}, NY ${zip}`,
        city,
        state: "NY",
        zip,
        phone: attrs.Site_Telephone_Number?.trim() || null,
        hoursJson: attrs.Site_Operating_Hours_per_Week
          ? { weekly_hours: attrs.Site_Operating_Hours_per_Week }
          : null,
        languages: null,
        eligibilityNotes:
          "Federally Qualified Health Center. Offers sliding-scale medical, dental, and behavioral health care; no one turned away for inability to pay.",
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
