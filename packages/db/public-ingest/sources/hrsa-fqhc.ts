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
const SOURCE_LABEL = "HRSA Health Center Service Delivery Sites";
const SOURCE_URL = "https://findahealthcenter.hrsa.gov/";
// V2-A 2026-04-22 — the previous HRSA ArcGIS FeatureServer URL
// (services.arcgis.com/qWZ7BaZXaP5isnfT/arcgis/rest/services/HRSA_Health_Center_Service_Delivery_Sites/FeatureServer/0)
// now requires a token and returns "Invalid URL" / 400 without one. Switch
// to the BPHC Data Warehouse public CSV download which is token-free and
// is the canonical source the FeatureServer was derived from
// (~885 NY rows, ~479 NYC rows at the time of this write).
const HRSA_CSV_URL =
  "https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv";
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
  OBJECTID?: number | null;
  Site_ID?: string | null;
  Site_Name?: string | null;
  Site_Address?: string | null;
  Site_City?: string | null;
  Site_State_Abbreviation?: string | null;
  State_Name?: string | null;
  Site_Postal_Code?: string | number | null;
  Site_Telephone_Number?: string | null;
  Health_Center_Service_Delivery_Site_Location_Setting_Description?: string | null;
  Site_Operating_Hours_per_Week?: string | number | null;
  Site_Status_Description?: string | null;
  Latitude?: number | null;
  Longitude?: number | null;
}

export interface HrsaFqhcFeature {
  attributes: HrsaFqhcAttributes;
  geometry?: { x?: number | null; y?: number | null };
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

/**
 * Minimal CSV parser. The HRSA CSV is ~13MB and standards-compliant RFC 4180
 * (no embedded newlines we've observed in the NY slice) but quoted fields
 * CAN contain commas. A single streaming pass is enough — we iterate line-
 * by-line and track quote state.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cur.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      cur.push(cell);
      rows.push(cur);
      cur = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || cur.length > 0) {
    cur.push(cell);
    rows.push(cur);
  }
  return rows.filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number.parseFloat(trimmed);
  return Number.isFinite(num) ? num : null;
}

async function fetchLive(opts?: FetchOptions): Promise<HrsaFqhcFeature[]> {
  await rateLimiter();
  // V2-A note — `data.hrsa.gov` responds with HTTP 406 Not Acceptable when
  // the client advertises `accept: text/csv`. Use `*/*` so the server
  // returns the CSV bytes rather than negotiating a content type it
  // refuses to serve.
  const response = await fetchWithRetry(HRSA_CSV_URL, {
    signal: opts?.signal,
    accept: "*/*",
  });
  if (!response.ok) {
    throw new Error(`hrsa_fqhc HTTP ${response.status}`);
  }
  const text = await response.text();
  const rows = parseCsv(text);
  if (rows.length <= 1) {
    return [];
  }
  const header = rows[0]!.map((h) => h.trim());
  // Column indices we care about. Falls back to -1 if the header rename
  // ever changes, in which case the row is skipped at normalize-time.
  const idx = (name: string) => header.indexOf(name);
  const iSiteName = idx("Site Name");
  const iAddress = idx("Site Address");
  const iCity = idx("Site City");
  const iState = idx("Site State Abbreviation");
  const iZip = idx("Site Postal Code");
  const iPhone = idx("Site Telephone Number");
  const iSetting = idx("Health Center Service Delivery Site Location Setting Description");
  const iHours = idx("Operating Hours per Week");
  const iStatus = idx("Site Status Description");
  const iLat = idx("Geocoding Artifact Address Primary Y Coordinate");
  const iLng = idx("Geocoding Artifact Address Primary X Coordinate");
  const iSiteId = idx("BPHC Assigned Number");
  const iBhcMis = idx("BHCMIS Organization Identification Number");
  const iLocId = idx("Health Center Location Identification Number");

  const features: HrsaFqhcFeature[] = [];
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r]!;
    const state = (row[iState] ?? "").trim();
    if (state !== "NY") continue;
    const status = (row[iStatus] ?? "").trim();
    if (status && status !== "Active") continue;
    const lat = toNumber(row[iLat]);
    const lng = toNumber(row[iLng]);
    features.push({
      attributes: {
        OBJECTID: Number.parseInt(row[iLocId] ?? "0", 10) || null,
        Site_ID: row[iSiteId] || row[iBhcMis] || null,
        Site_Name: row[iSiteName] ?? null,
        Site_Address: row[iAddress] ?? null,
        Site_City: row[iCity] ?? null,
        Site_State_Abbreviation: "NY",
        State_Name: "New York",
        Site_Postal_Code: (row[iZip] ?? "").slice(0, 5),
        Site_Telephone_Number: row[iPhone] ?? null,
        Health_Center_Service_Delivery_Site_Location_Setting_Description:
          row[iSetting] ?? null,
        Site_Operating_Hours_per_Week: row[iHours] ?? null,
        Site_Status_Description: status || null,
        Latitude: lat,
        Longitude: lng,
      },
      geometry: { x: lng, y: lat },
    });
  }
  return features;
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
      const hoursRaw = attrs.Site_Operating_Hours_per_Week;
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
        hoursJson:
          hoursRaw !== null && hoursRaw !== undefined && `${hoursRaw}`.trim() !== ""
            ? { weekly_hours: `${hoursRaw}` }
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
