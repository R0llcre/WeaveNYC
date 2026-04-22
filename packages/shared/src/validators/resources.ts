import { z } from "zod";

// Keep this enum in sync with services/api-gateway/src/contracts.ts resourceSummary.type
// and with packages/db/public-ingest/sources/* normalize outputs.
// 2026-04-21: expanded to include public-source types (snap_retailer / fqhc /
// senior_meal_site / soup_kitchen / mobile_pantry / community_fridge) — before
// this fix the PWA's Zod validator rejected entire responses when they
// contained a single row with a non-core type, silently collapsing the home
// screen to the "nothing nearby" empty state even when the API returned rows.
export const resourceTypeSchema = z.enum([
  "pantry",
  "kitchen",
  "market",
  "benefits",
  "other",
  "snap_retailer",
  "senior_meal_site",
  "fqhc",
  "soup_kitchen",
  "mobile_pantry",
  "community_fridge"
]);
export const geoPrecisionSchema = z.enum([
  "exact",
  "rooftop",
  "street",
  "zip_centroid",
  "unknown"
]);

export const resourceHoursEntrySchema = z.object({
  day: z.string().min(1),
  windows: z.array(
    z.object({
      opens_at: z.string().min(1),
      closes_at: z.string().min(1)
    })
  ),
  closed: z.boolean()
});

export const resourceSummarySchema = z.object({
  provider_id: z.string().uuid(),
  name: z.string().min(1),
  type: resourceTypeSchema,
  address: z.string().min(1),
  city: z.string().min(1).nullable(),
  state: z.string().min(1).nullable(),
  zip: z.string().regex(/^\d{5}$/),
  phone: z.string().min(1).nullable(),
  languages: z.array(z.string()),
  source: z.string().min(1),
  source_label: z.string().min(1).nullable(),
  source_dataset_version: z.string().min(1).nullable().optional(),
  notes: z.string().min(1).nullable(),
  distance_miles: z.number().nonnegative().nullable(),
  is_open_today: z.boolean(),
  is_open_now: z.boolean(),
  geo_precision: geoPrecisionSchema,
  directions_url: z.string().url()
});

export const resourceDetailSchema = resourceSummarySchema.extend({
  weekly_hours: z.array(resourceHoursEntrySchema),
  source_url: z.string().url().nullable(),
  requested_provider_id: z.string().uuid().nullable()
});

export const resourceListResponseSchema = z.object({
  items: z.array(resourceSummarySchema),
  next_cursor: z.string().min(1).nullable(),
  source_mode: z.enum(["api", "fixture"]),
  // A5 P0 bonus — optional "the geocoder returned nothing for this ZIP" hint.
  // Kept optional for backwards-compatibility: legacy responses omit it.
  no_results_in_area: z.boolean().optional(),
  // V2-A — optional effective search radius in miles. Populated when the
  // repository's progressive-widening loop lands on a tier > 5 (PWA uses
  // this to render "no results within 5 mi — showing within N mi" banner).
  // `null` when the geocoder couldn't resolve the ZIP so no radius walk
  // happened; absent on legacy callers for backwards compat.
  widened_to_miles: z.number().positive().nullable().optional()
});

export const resourceSearchRequestSchema = z.object({
  zip: z.string().regex(/^\d{5}$/),
  open_now: z.coerce.boolean().optional(),
  today: z.coerce.boolean().optional(),
  type: resourceTypeSchema.optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  cursor: z.string().regex(/^[A-Za-z0-9_-]+$/).nullable().optional()
});

export const resourceDetailQuerySchema = z.object({
  zip: z.string().regex(/^\d{5}$/).optional()
});
