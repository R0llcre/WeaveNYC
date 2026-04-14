import { boolean, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { communities } from "./communities";
import { announcementStatusEnum } from "./enums";
import { users } from "./users";

export const announcements = pgTable(
  "announcements",
  {
    announcementId: uuid("announcement_id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
    title: varchar("title", { length: 140 }).notNull(),
    body: text("body").notNull(),
    status: announcementStatusEnum("status").notNull().default("active"),
    isPinned: boolean("is_pinned").notNull().default(false),
    ipfsCid: varchar("ipfs_cid", { length: 100 }),
    p2pVersion: integer("p2p_version").notNull().default(1),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.userId),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    communityPublishedIdx: index("idx_announcements_community_published_at").on(
      table.communityId,
      table.publishedAt
    )
  })
);
