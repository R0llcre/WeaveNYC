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
const SOURCE_URL =
  "https://usda-snap-retailers-usda-fns.hub.arcgis.com/datasets/USDA-FNS::snap-retailer-location-data";
// V2-A 2026-04-22 — the previous ArcGIS FeatureServer
// (services1.arcgis.com/RLQu0rK7h4kbsBq5/.../Store_Locations/FeatureServer/0)
// now responds with "Token Required" (USDA rotated to an authenticated
// layer). Switch to the public ArcGIS-hub CSV mirror which is token-free
// and refreshed by USDA on the same cadence (~16,890 NY rows at the time
// of this write, ~8,685 in the five boroughs). The hub endpoint returns
// HTTP 202 + a pending job on first hit, so the live path may need a short
// poll; the `fetchLive` helper retries a few times before giving up and
// letting the ingest orchestrator fall back to the committed fixture.
const USDA_CSV_URL =
  "https://usda-snap-retailers-usda-fns.hub.arcgis.com/datasets/USDA-FNS::snap-retailer-location-data.csv?where=State%3D%27NY%27";
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

const rateLimiter = createRateLimiter({ rps: 1, burst: 1 });

export interface UsdaSnapAttributes {
  OBJECTID?: number | null;
  Store_Name?: string | null;
  Address?: string | null;
  Address_Line__2?: string | null;
  City?: string | null;
  State?: string | null;
  Zip5?: string | number | null;
  Zip4?: string | number | null;
  County?: string | null;
  Latitude?: number | null;
  Longitude?: number | null;
}

export interface UsdaSnapFeature {
  attributes: UsdaSnapAttributes;
  geometry?: { x?: number | null; y?: number | null };
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

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Strip UTF-8 BOM
  let start = 0;
  if (text.charCodeAt(0) === 0xfeff) start = 1;
  for (let i = start; i < text.length; i += 1) {
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

async function fetchLive(opts?: FetchOptions): Promise<UsdaSnapFeature[]> {
  // ArcGIS hub CSV downloads return 202 Accepted with a pending-job payload
  // on the first request while the export is generated. Poll up to 5 times
  // (~60s total) before we give up and let the caller fall back to the
  // checked-in fixture.
  let attempt = 0;
  for (;;) {
    attempt += 1;
    await rateLimiter();
    const response = await fetchWithRetry(USDA_CSV_URL, {
      signal: opts?.signal,
      accept: "text/csv",
    });
    if (response.status === 202) {
      if (attempt >= 5) {
        throw new Error(`usda_snap HTTP 202 (export pending) after ${attempt} tries`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      continue;
    }
    if (!response.ok) {
      throw new Error(`usda_snap HTTP ${response.status}`);
    }
    const text = await response.text();
    const rows = parseCsv(text);
    if (rows.length <= 1) return [];
    const header = rows[0]!.map((h) => h.trim());
    const idx = (name: string) => header.indexOf(name);
    const iStore = idx("Store_Name");
    const iAddr = idx("Store_Street_Address");
    const iAddr2 = idx("Additonal_Address");
    const iCity = idx("City");
    const iState = idx("State");
    const iZip = idx("Zip_Code");
    const iZip4 = idx("Zip4");
    const iCounty = idx("County");
    const iLat = idx("Latitude");
    const iLng = idx("Longitude");
    const iObj = idx("ObjectId");
    const out: UsdaSnapFeature[] = [];
    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r]!;
      const state = (row[iState] ?? "").trim();
      if (state && state !== "NY") continue;
      const lat = toNumber(row[iLat]);
      const lng = toNumber(row[iLng]);
      out.push({
        attributes: {
          OBJECTID: Number.parseInt(row[iObj] ?? "0", 10) || null,
          Store_Name: row[iStore] ?? null,
          Address: row[iAddr] ?? null,
          Address_Line__2: row[iAddr2] ?? null,
          City: row[iCity] ?? null,
          State: "NY",
          Zip5: (row[iZip] ?? "").slice(0, 5),
          Zip4: row[iZip4] ?? null,
          County: row[iCounty] ?? null,
          Latitude: lat,
          Longitude: lng,
        },
        geometry: { x: lng, y: lat },
      });
    }
    return out;
  }
}

export const usdaSnap: PublicSourceModule<UsdaSnapFeature> = {
  id: SOURCE_ID,
  sourceLabel: SOURCE_LABEL,
  sourceUrl: SOURCE_URL,
  rateLimit: { rps: 1, burst: 1 },

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
