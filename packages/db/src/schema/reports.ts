import { pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./users";

export const reportStatusEnum = pgEnum("report_status", ["new", "in_review", "resolved", "dismissed"]);
export const reportReasonEnum = pgEnum("report_reason", [
  "harassment",
  "scam",
  "misinformation",
  "unsafe_behavior",
  "other"
]);
export const resolutionEnum = pgEnum("resolution", ["remove_post", "suspend_user", "warn", "none"]);

export const reports = pgTable("reports", {
  reportId: uuid("report_id").primaryKey().defaultRandom(),
  targetType: varchar("target_type", { length: 20 }).notNull(),
  targetId: uuid("target_id").notNull(),
  reason: reportReasonEnum("reason").notNull(),
  detailText: text("detail_text"),
  reporterUserId: uuid("reporter_user_id")
    .notNull()
    .references(() => users.userId),
  status: reportStatusEnum("status").notNull().default("new"),
  resolution: resolutionEnum("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
});
