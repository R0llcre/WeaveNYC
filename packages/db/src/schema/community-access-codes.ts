import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { communities } from "./communities";
import { communityAccessChannelEnum, communityAccessCodeStatusEnum } from "./enums";

export const communityAccessCodes = pgTable(
  "community_access_codes",
  {
    accessCodeId: uuid("access_code_id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
    channel: communityAccessChannelEnum("channel").notNull(),
    code: varchar("code", { length: 140 }).notNull(),
    status: communityAccessCodeStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    communityStatusIdx: index("idx_community_access_codes_community_status").on(
      table.communityId,
      table.status,
      table.channel
    ),
    codeLookupIdx: index("idx_community_access_codes_channel_code").on(table.channel, table.code),
    activeChannelCodeUq: uniqueIndex("uq_community_access_codes_active_channel_code")
      .on(table.channel, table.code)
      .where(sql`${table.status} = 'active'`),
  })
);
