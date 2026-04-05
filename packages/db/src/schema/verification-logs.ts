import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { resourceProviders } from "./resource-providers";

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
