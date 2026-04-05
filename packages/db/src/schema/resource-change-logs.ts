import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { datasetVersions } from "./dataset-versions";

export const resourceChangeLogs = pgTable("resource_change_logs", {
  changeLogId: uuid("change_log_id").primaryKey().defaultRandom(),
  source: varchar("source", { length: 50 }).notNull(),
  sourceRef: varchar("source_ref", { length: 200 }).notNull(),
  datasetVersion: varchar("dataset_version", { length: 50 })
    .notNull()
    .references(() => datasetVersions.datasetVersion),
  changeType: varchar("change_type", { length: 20 }).notNull(),
  changedFields: text("changed_fields").array(),
  contentHashBefore: varchar("content_hash_before", { length: 64 }),
  contentHashAfter: varchar("content_hash_after", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
