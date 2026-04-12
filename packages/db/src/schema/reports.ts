import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { communities } from "./communities";
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

export const reports = pgTable(
  "reports",
  {
    reportId: uuid("report_id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
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
  },
  (table) => ({
    communityCreatedIdx: index("idx_reports_community_created_at").on(table.communityId, table.createdAt)
  })
);
