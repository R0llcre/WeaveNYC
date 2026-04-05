import { jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { communities } from "./communities";

export const anchors = pgTable("anchors", {
  anchorId: uuid("anchor_id").primaryKey().defaultRandom(),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.communityId),
  orgName: varchar("org_name", { length: 200 }).notNull(),
  contact: varchar("contact", { length: 200 }),
  roleAssignments: jsonb("role_assignments"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
