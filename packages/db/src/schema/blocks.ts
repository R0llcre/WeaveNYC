import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { conversations } from "./conversations";
import { users } from "./users";

export const blocks = pgTable(
  "blocks",
  {
    blockId: uuid("block_id").primaryKey().defaultRandom(),
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.userId),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.userId),
    conversationId: uuid("conversation_id").references(() => conversations.conversationId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    blockerIdx: index("idx_blocks_blocker").on(table.blockerUserId, table.createdAt),
    blockedIdx: index("idx_blocks_blocked").on(table.blockedUserId, table.createdAt),
    pairUq: uniqueIndex("uq_blocks_pair").on(table.blockerUserId, table.blockedUserId),
  }),
);
