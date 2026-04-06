import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const datasetVersionStatusEnum = pgEnum("dataset_version_status", [
  "importing",
  "active",
  "superseded",
  "failed"
]);

export const datasetVersions = pgTable(
  "dataset_versions",
  {
    datasetVersionId: uuid("dataset_version_id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(),
    datasetVersion: varchar("dataset_version", { length: 50 }).notNull(),
    sourceLabel: varchar("source_label", { length: 120 }),
    sourceUrl: text("source_url"),
    recordCount: integer("record_count").notNull(),
    activeRecordCount: integer("active_record_count").notNull().default(0),
    status: datasetVersionStatusEnum("status").notNull().default("importing"),
    checksum: varchar("checksum", { length: 64 }),
    importStartedAt: timestamp("import_started_at", { withTimezone: true }).notNull(),
    importCompletedAt: timestamp("import_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    datasetSourceUq: uniqueIndex("uq_dataset_versions_source_version").on(
      table.source,
      table.datasetVersion
    )
  })
);
