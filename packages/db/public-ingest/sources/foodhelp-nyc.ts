import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createRateLimiter, fetchWithRetry } from "../http";
import { assertNoPersonPii } from "../pii";
import type {
  FetchOptions,
  PublicSourceModule,
  ResourceProviderSeed,
  ResourceProviderType,
  SourceAttribution,
} from "../types";

const SOURCE_ID = "foodhelp_nyc";
const SOURCE_LABEL = "NYC HRA Food Help NYC";
const SOURCE_URL = "https://finder.nyc.gov/foodhelp/";
// V2-A 2026-04-22 — the legacy Socrata dataset `kwhm-eh2p` no longer exists
// (HRA retired the public CSV in late 2025; `data.cityofnewyork.us` now
// returns HTTP 404). The live Food Help NYC finder at finder.nyc.gov/foodhelp
// is a React SPA that queries a private NYC-internal service, not a public
// Socrata layer. A search of `data.cityofnewyork.us` for "food pantry",
// "soup kitchen", and "HRA Community Food Connection" returned only the
// aggregate quarterly report `mpqk-skis` (no addresses).
//
// Until HRA republishes site-level data we fall back to the committed
// fixture `fixtures/foodhelp-nyc.raw.sample.json`, which is hand-curated
// from well-known public pantry/soup-kitchen addresses across all five
// boroughs (65 rows spanning the Midtown/Bushwick/Williamsburg ZIPs
// the prior dataset collapsed to zero on).
//
// The `SOCRATA_URL` constant is kept for historical context — `fetchLive`
// still tries it once so the code path exists if HRA ever republishes the
// dataset under the same ID. The 404 is caught and the ingest pipeline
// transparently falls back to the fixture (see the `fetch` method below).
const SOCRATA_URL =
  "https://data.cityofnewyork.us/resource/kwhm-eh2p.json?$limit=5000";
const FIXTURE_PATH = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "foodhelp-nyc.raw.sample.json"
);

function currentDatasetVersion(): string {
  // ISO year + ISO week, stable for a week at a time so reproductions during
  // the same class session land on the same dataset_versions row.
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${SOURCE_ID}_${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

const rateLimiter = createRateLimiter({ rps: 1, burst: 1 });

export interface FoodhelpNycRaw {
  /** Upstream stable id. Example: "foodhelp-123". */
  id?: string;
  /** Possible alternates seen in Socrata. */
  unique_id?: string;
  program_id?: string;
  name?: string;
  program_name?: string;
  agency_name?: string;
  service_type?: string;
  program_type?: string;
  address?: string;
  address_1?: string;
  street_address?: string;
  city?: string;
  borough?: string;
  state?: string;
  zip_code?: string;
  zipcode?: string;
  phone?: string;
  phone_number?: string;
  latitude?: string | number;
  longitude?: string | number;
  languages_spoken?: string;
  hours?: string;
  eligibility?: string;
  eligibility_notes?: string;
}

function coerceType(raw: string | undefined): ResourceProviderType {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("soup") || v.includes("kitchen")) return "soup_kitchen";
  if (v.includes("mobile")) return "mobile_pantry";
  return "pantry";
}

function normalizeLanguages(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const parts = raw
    .split(/[,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return null;
  // Keep only the three locales we support app-side + drop duplicates.
  const accepted = new Set<string>();
  for (const part of parts) {
    if (part.startsWith("en")) accepted.add("en");
    else if (part.startsWith("es") || part.includes("spanish")) accepted.add("es");
    else if (part.startsWith("zh") || part.includes("chinese") || part.includes("mandarin") || part.includes("cantonese")) accepted.add("zh");
  }
  return accepted.size > 0 ? Array.from(accepted) : null;
}

function hashContent(row: ResourceProviderSeed): string {
  const payload = JSON.stringify({
    source: row.source,
    sourceRef: row.sourceRef,
    name: row.name,
    type: row.type,
    addressText: row.addressText,
    city: row.city,
    state: row.state,
    zip: row.zip,
    phone: row.phone,
    lat: row.lat,
    lng: row.lng,
    hoursJson: row.hoursJson,
    languages: row.languages,
    eligibilityNotes: row.eligibilityNotes,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function parseNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

async function readFixture(): Promise<FoodhelpNycRaw[]> {
  const text = await readFile(FIXTURE_PATH, "utf8");
  const parsed = JSON.parse(text) as FoodhelpNycRaw[];
  return Array.isArray(parsed) ? parsed : [];
}

async function fetchLive(opts?: FetchOptions): Promise<FoodhelpNycRaw[]> {
  await rateLimiter();
  const response = await fetchWithRetry(SOCRATA_URL, {
    signal: opts?.signal,
    accept: "application/json",
  });
  if (!response.ok) {
    throw new Error(`foodhelp_nyc HTTP ${response.status}`);
  }
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as FoodhelpNycRaw[]) : [];
}

export const foodhelpNyc: PublicSourceModule<FoodhelpNycRaw> = {
  id: SOURCE_ID,
  sourceLabel: SOURCE_LABEL,
  sourceUrl: SOURCE_URL,
  rateLimit: { rps: 1, burst: 1 },

  async fetch(opts: FetchOptions = {}): Promise<FoodhelpNycRaw[]> {
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

  normalize(raw: FoodhelpNycRaw[]): ResourceProviderSeed[] {
    const datasetVersion = currentDatasetVersion();
    const out: ResourceProviderSeed[] = [];
    for (const entry of raw) {
      const id =
        entry.id ??
        entry.unique_id ??
        entry.program_id ??
        `${entry.program_name ?? entry.name ?? "unknown"}-${entry.zip_code ?? entry.zipcode ?? ""}`;
      const name = entry.name ?? entry.program_name ?? entry.agency_name;
      const zip = String(entry.zip_code ?? entry.zipcode ?? "").slice(0, 5);
      const address = entry.address ?? entry.address_1 ?? entry.street_address ?? "";
      if (!name || !zip || !address) continue;
      const lat = parseNumber(entry.latitude);
      const lng = parseNumber(entry.longitude);
      const seed: ResourceProviderSeed = {
        source: SOURCE_ID,
        sourceRef: `${SOURCE_ID}:${id}`,
        name: name.trim(),
        type: coerceType(entry.service_type ?? entry.program_type),
        addressText: `${address}${entry.city ? `, ${entry.city}` : ""}, NY ${zip}`,
        city: (entry.city ?? entry.borough ?? null)?.trim() || null,
        state: "NY",
        zip,
        phone: (entry.phone ?? entry.phone_number ?? null)?.trim() || null,
        hoursJson: entry.hours ? { raw: entry.hours } : null,
        languages: normalizeLanguages(entry.languages_spoken),
        eligibilityNotes: (entry.eligibility ?? entry.eligibility_notes ?? null) || null,
        lat,
        lng,
        geoPrecision: lat !== null && lng !== null ? "street" : "zip_centroid",
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
