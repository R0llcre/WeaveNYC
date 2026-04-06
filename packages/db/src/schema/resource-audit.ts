import { foreignKey, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { datasetVersions } from "./dataset-versions.js";
import { resourceProviders } from "./resource-providers.js";

export const resourceChangeLogs = pgTable(
  "resource_change_logs",
  {
    changeLogId: uuid("change_log_id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(),
    sourceRef: varchar("source_ref", { length: 200 }).notNull(),
    datasetVersion: varchar("dataset_version", { length: 50 }).notNull(),
    changeType: varchar("change_type", { length: 20 }).notNull(),
    changedFields: text("changed_fields").array(),
    contentHashBefore: varchar("content_hash_before", { length: 64 }),
    contentHashAfter: varchar("content_hash_after", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sourceDatasetVersionFk: foreignKey({
      columns: [table.source, table.datasetVersion],
      foreignColumns: [datasetVersions.source, datasetVersions.datasetVersion],
      name: "fk_resource_change_logs_source_dataset_version"
    })
  })
);

export const verificationLogs = pgTable("verification_logs", {
  verificationLogId: uuid("verification_log_id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => resourceProviders.providerId),
  verifier: varchar("verifier", { length: 100 }).notNull(),
  method: varchar("method", { length: 30 }).notNull(),
  result: varchar("result", { length: 30 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
