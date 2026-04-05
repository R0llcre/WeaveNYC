import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { communities } from "./communities";
import { reports } from "./reports";
import { users } from "./users";

export const moderationActions = pgTable("moderation_actions", {
  actionId: uuid("action_id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").references(() => reports.reportId),
  anchorUserId: uuid("anchor_user_id")
    .notNull()
    .references(() => users.userId),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.communityId),
  actionType: varchar("action_type", { length: 30 }).notNull(),
  targetType: varchar("target_type", { length: 20 }).notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
