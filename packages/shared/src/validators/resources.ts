import { z } from "zod";

export const resourceTypeSchema = z.enum(["pantry", "kitchen", "market", "benefits", "other"]);
export const geoPrecisionSchema = z.enum([
  "exact",
  "rooftop",
  "street",
  "zip_centroid",
  "unknown"
]);

export const resourceHoursEntrySchema = z.object({
  day: z.string().min(1),
  opens_at: z.string().min(1).nullable(),
  closes_at: z.string().min(1).nullable(),
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
  source_mode: z.enum(["api", "fixture"])
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
