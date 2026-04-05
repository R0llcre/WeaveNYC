import { pgEnum, pgTable, primaryKey, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./users";

export const joinPolicyEnum = pgEnum("join_policy", ["invite_only", "open"]);

export const communities = pgTable("communities", {
  communityId: uuid("community_id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  centerZip: varchar("center_zip", { length: 10 }).notNull(),
  joinPolicy: joinPolicyEnum("join_policy").notNull().default("invite_only"),
  rulesetId: uuid("ruleset_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const communityMembers = pgTable(
  "community_members",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    communityMemberPk: primaryKey({ columns: [table.userId, table.communityId] })
  })
);
