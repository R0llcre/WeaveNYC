export type ResourceSource = "cfc_active" | "island_harvest" | "manual_official";

export type ResourceType = "pantry" | "kitchen" | "market" | "benefits" | "other";

export type GeoPrecision = "exact" | "rooftop" | "street" | "zip_centroid" | "unknown";

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface HoursRecord {
  mon?: string | null;
  tue?: string | null;
  wed?: string | null;
  thu?: string | null;
  fri?: string | null;
  sat?: string | null;
  sun?: string | null;
  notes?: string | null;
}

export interface NormalizedResourceRecord {
  source: ResourceSource;
  sourceRef: string;
  name: string;
  type: ResourceType;
  addressText: string;
  city: string | null;
  state: string | null;
  zip: string;
  phone: string | null;
  hoursJson: HoursRecord | null;
  languages: string[];
  eligibilityNotes: string | null;
  lat: number | null;
  lng: number | null;
  geoPrecision: GeoPrecision;
  sourceUrl: string | null;
}

export interface GeocodeResult {
  lat: number | null;
  lng: number | null;
  geoPrecision: GeoPrecision;
}

export interface DatasetImportSummary {
  datasetVersion: string;
  source: ResourceSource;
  sourceUrl: string;
  recordCount: number;
  activeRecordCount: number;
  added: number;
  updated: number;
  removed: number;
}

export interface ImportOptions {
  mode?: "live" | "fixture";
  datasetVersion?: string;
}

export interface ResourceSearchInput {
  zip: string;
  openNow?: boolean;
  today?: boolean;
  type?: ResourceType;
  limit?: number;
  cursor?: string | null;
}

export interface ResourceListItem {
  providerId: string;
  requestedProviderId?: string | null;
  name: string;
  type: ResourceType;
  address: string;
  city: string | null;
  state: string | null;
  zip: string;
  phone: string | null;
  languages: string[];
  source: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  sourceDatasetVersion?: string | null;
  notes: string | null;
  distanceMiles: number | null;
  isOpenToday: boolean;
  isOpenNow: boolean;
  geoPrecision: GeoPrecision;
  weeklyHours: Array<{
    day: string;
    opensAt: string | null;
    closesAt: string | null;
    closed: boolean;
  }>;
}

export interface ResourceSearchResult {
  items: ResourceListItem[];
  nextCursor: string | null;
  sourceMode: "api" | "fixture";
}
