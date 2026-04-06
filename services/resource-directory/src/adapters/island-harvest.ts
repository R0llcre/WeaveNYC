import { readFile } from "node:fs/promises";
import { fetchWithRetry } from "../lib/http.js";
import { normalizeZip } from "../lib/address.js";
import { normalizeHoursValue } from "../lib/hours.js";
import type { ImportOptions, NormalizedResourceRecord, ResourceType } from "../types.js";

export const islandHarvestSourceUrl = 'https://storerocket.io/api/user/n0pjnLgp6V/locations';
export const islandHarvestWidgetId = 'n0pjnLgp6V';

interface StoreRocketLocation {
  id: number;
  name: string;
  lat: string | null;
  lng: string | null;
  phone: string | null;
  address: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  hours?: Record<string, string | null>;
  filters?: Array<{ name: string }>;
  obf_id?: string;
}

interface StoreRocketPayload {
  success: boolean;
  results: {
    locations: StoreRocketLocation[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertStoreRocketPayload(payload: unknown): asserts payload is StoreRocketPayload {
  if (!isRecord(payload) || payload.success !== true) {
    throw new Error("Island Harvest payload is missing success=true");
  }

  const results = payload.results;
  if (!isRecord(results) || !Array.isArray(results.locations)) {
    throw new Error("Island Harvest payload is missing results.locations");
  }
}

function mapType(location: StoreRocketLocation): ResourceType {
  const filters = location.filters?.map((entry) => entry.name.toLowerCase()) ?? [];
  if (filters.some((entry) => entry.includes("soup") || entry.includes("kitchen"))) {
    return "kitchen";
  }
  if (filters.some((entry) => entry.includes("pantry"))) {
    return "pantry";
  }
  if (filters.some((entry) => entry.includes("market"))) {
    return "market";
  }
  if (filters.some((entry) => entry.includes("benefit"))) {
    return "benefits";
  }
  return "other";
}

function mapHours(hours: StoreRocketLocation['hours']) {
  if (!hours) {
    return null;
  }

  return {
    mon: normalizeHoursValue(hours.mon),
    tue: normalizeHoursValue(hours.tue),
    wed: normalizeHoursValue(hours.wed),
    thu: normalizeHoursValue(hours.thu),
    fri: normalizeHoursValue(hours.fri),
    sat: normalizeHoursValue(hours.sat),
    sun: normalizeHoursValue(hours.sun)
  };
}

function normalizeLocation(location: StoreRocketLocation): NormalizedResourceRecord | null {
  const name = location.name.trim();
  const addressText = (location.address_line_1 ?? location.address ?? '').trim();
  const zip = location.postcode ? normalizeZip(location.postcode) : null;
  const lat = location.lat ? Number(location.lat) : null;
  const lng = location.lng ? Number(location.lng) : null;
  const hasFiniteCoords = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);

  if (!name || !addressText || !zip) {
    return null;
  }

  return {
    source: "island_harvest",
    sourceRef: `island_harvest:${location.obf_id ?? location.id}`,
    name,
    type: mapType(location),
    addressText,
    city: location.city?.trim() ?? null,
    state: location.state?.trim() ?? "NY",
    zip,
    phone: location.phone?.trim() ?? null,
    hoursJson: mapHours(location.hours),
    languages: [],
    eligibilityNotes: "Imported from Island Harvest pantry finder.",
    lat: hasFiniteCoords ? lat : null,
    lng: hasFiniteCoords ? lng : null,
    geoPrecision: hasFiniteCoords ? "street" : "unknown",
    sourceUrl: islandHarvestSourceUrl
  };
}

async function loadLivePayload(fetchImpl: typeof fetch = fetch): Promise<StoreRocketPayload> {
  const requestInit = {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 WeaveNYC/0.1"
    }
  } satisfies RequestInit;
  const response = fetchImpl === fetch ? await fetchWithRetry(islandHarvestSourceUrl, requestInit) : await fetchImpl(islandHarvestSourceUrl, requestInit);

  if (!response.ok) {
    throw new Error(`Failed to download Island Harvest feed: ${response.status}`);
  }

  const payload = await response.json();
  assertStoreRocketPayload(payload);
  return payload;
}

export async function loadIslandHarvestRecords(
  options: ImportOptions = {},
  fetchImpl: typeof fetch = fetch
): Promise<NormalizedResourceRecord[]> {
  const mode = options.mode ?? "live";
  const payload =
    mode === "fixture" ? await loadIslandHarvestFixturePayload() : await loadLivePayload(fetchImpl);

  return payload.results.locations
    .map(normalizeLocation)
    .filter((record): record is NormalizedResourceRecord => record !== null);
}

async function loadIslandHarvestFixturePayload(): Promise<StoreRocketPayload> {
  const raw = await readFile(new URL("../fixtures/island-harvest.json", import.meta.url), "utf8");
  const payload = JSON.parse(raw) as unknown;
  assertStoreRocketPayload(payload);
  return payload;
}
