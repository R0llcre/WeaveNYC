import {
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

import { datasetVersions } from "./dataset-versions";

export const resourceStatusEnum = pgEnum("resource_status", ["active", "inactive"]);

export const resourceProviders = pgTable(
  "resource_providers",
  {
    providerId: uuid("provider_id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(),
    sourceRef: varchar("source_ref", { length: 200 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    addressText: text("address_text").notNull(),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zip: varchar("zip", { length: 10 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    hoursJson: jsonb("hours_json"),
    languages: text("languages").array(),
    eligibilityNotes: text("eligibility_notes"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    geoPrecision: varchar("geo_precision", { length: 20 }).default("zip_centroid"),
    contentHash: varchar("content_hash", { length: 64 }),
    datasetVersion: varchar("dataset_version", { length: 50 })
      .notNull()
      .references(() => datasetVersions.datasetVersion),
    status: resourceStatusEnum("status").notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    zipTypeIdx: index("idx_resources_zip_type").on(table.zip, table.type),
    sourceRefIdx: index("idx_resources_source_ref").on(table.source, table.sourceRef),
    datasetStatusIdx: index("idx_resources_dataset_status").on(table.datasetVersion, table.status),
    sourceRefVersionUq: uniqueIndex("uq_resources_source_ref_version").on(
      table.source,
      table.sourceRef,
      table.datasetVersion
    )
  })
);
