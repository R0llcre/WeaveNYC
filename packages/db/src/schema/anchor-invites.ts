import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { communities } from "./communities";
import { anchorInviteStatusEnum } from "./enums";
import { users } from "./users";

export const anchorInvites = pgTable(
  "anchor_invites",
  {
    anchorInviteId: uuid("anchor_invite_id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    orgName: varchar("org_name", { length: 200 }),
    status: anchorInviteStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    consumedByUserId: uuid("consumed_by_user_id").references(() => users.userId),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeHashUq: uniqueIndex("uq_anchor_invites_code_hash").on(table.codeHash),
    communityStatusIdx: index("idx_anchor_invites_community_status").on(
      table.communityId,
      table.status,
      table.createdAt
    )
  })
);
