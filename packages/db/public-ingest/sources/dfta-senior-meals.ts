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

const SOURCE_ID = "nyc_dfta_senior_meals";
const SOURCE_LABEL = "NYC Department for the Aging (DFTA) Senior Meal Sites";
const SOURCE_URL = "https://data.cityofnewyork.us/resource/6j6t-3ixh.json";

const ACCEPTED_PROGRAM_TYPES = new Set<string>([
  "senior center",
  "home delivered meal",
  "older adult center",
]);

const SOCRATA_URL =
  "https://data.cityofnewyork.us/resource/6j6t-3ixh.json?$limit=5000";
const FIXTURE_PATH = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "dfta-senior-meals.raw.sample.json"
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

export interface DftaSeniorMealsRaw {
  program_id?: string;
  program_name?: string;
  name?: string;
  program_type?: string;
  address?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  zipcode?: string;
  phone?: string;
  borough?: string;
  latitude?: string | number;
  longitude?: string | number;
  hours?: string;
  meal_type?: string;
  eligibility?: string;
  languages_spoken?: string;
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
    hoursJson: row.hoursJson,
    eligibilityNotes: row.eligibilityNotes,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function parseNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeLanguages(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const parts = raw
    .split(/[,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const accepted = new Set<string>();
  for (const part of parts) {
    if (part.startsWith("en")) accepted.add("en");
    else if (part.startsWith("es") || part.includes("spanish")) accepted.add("es");
    else if (part.startsWith("zh") || part.includes("chinese") || part.includes("mandarin") || part.includes("cantonese")) accepted.add("zh");
  }
  return accepted.size > 0 ? Array.from(accepted) : null;
}

async function readFixture(): Promise<DftaSeniorMealsRaw[]> {
  const text = await readFile(FIXTURE_PATH, "utf8");
  const parsed = JSON.parse(text) as DftaSeniorMealsRaw[];
  return Array.isArray(parsed) ? parsed : [];
}

async function fetchLive(opts?: FetchOptions): Promise<DftaSeniorMealsRaw[]> {
  await rateLimiter();
  const response = await fetchWithRetry(SOCRATA_URL, {
    signal: opts?.signal,
    accept: "application/json",
  });
  if (!response.ok) {
    throw new Error(`dfta_senior_meals HTTP ${response.status}`);
  }
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as DftaSeniorMealsRaw[]) : [];
}

export const dftaSeniorMeals: PublicSourceModule<DftaSeniorMealsRaw> = {
  id: SOURCE_ID,
  sourceLabel: SOURCE_LABEL,
  sourceUrl: SOURCE_URL,
  rateLimit: { rps: 1, burst: 1 },

  async fetch(opts: FetchOptions = {}): Promise<DftaSeniorMealsRaw[]> {
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

  normalize(raw: DftaSeniorMealsRaw[]): ResourceProviderSeed[] {
    const datasetVersion = currentDatasetVersion();
    const out: ResourceProviderSeed[] = [];
    for (const entry of raw) {
      const programType = (entry.program_type ?? "").trim().toLowerCase();
      if (!ACCEPTED_PROGRAM_TYPES.has(programType)) continue;
      const name = (entry.program_name ?? entry.name ?? "").trim();
      const zip = String(entry.zip_code ?? entry.zipcode ?? "").slice(0, 5);
      const address = entry.address ?? entry.street_address ?? "";
      if (!name || !zip || !address) continue;
      const lat = parseNumber(entry.latitude);
      const lng = parseNumber(entry.longitude);
      const city = (entry.city ?? entry.borough ?? null)?.trim() || null;
      const seed: ResourceProviderSeed = {
        source: SOURCE_ID,
        sourceRef: `${SOURCE_ID}:${entry.program_id ?? `${name}-${zip}`}`,
        name,
        type: "senior_meal_site",
        addressText: `${address}${city ? `, ${city}` : ""}, NY ${zip}`,
        city,
        state: "NY",
        zip,
        phone: (entry.phone ?? null)?.trim() || null,
        hoursJson: entry.hours ? { raw: entry.hours } : null,
        languages: normalizeLanguages(entry.languages_spoken),
        eligibilityNotes:
          entry.eligibility?.trim() ||
          "Older Adult Center / senior meal program. Typically ages 60+.",
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
