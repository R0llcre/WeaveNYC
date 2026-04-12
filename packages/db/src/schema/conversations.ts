import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { contactRequests } from "./contact-requests";
import { users } from "./users";

export const conversationStatusEnum = pgEnum("conversation_status", ["active", "closed", "blocked"]);

export const conversations = pgTable(
  "conversations",
  {
    conversationId: uuid("conversation_id").primaryKey().defaultRandom(),
    participants: uuid("participants").array().notNull(),
    relatedPostIds: uuid("related_post_ids").array(),
    contactRequestId: uuid("contact_request_id")
      .notNull()
      .references(() => contactRequests.contactRequestId),
    status: conversationStatusEnum("status").notNull().default("active"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    blockedByUserId: uuid("blocked_by_user_id").references(() => users.userId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    contactRequestUq: uniqueIndex("uq_conversations_contact_request_id").on(table.contactRequestId),
    lastActivityIdx: index("idx_conversations_last_activity").on(table.lastActivityAt, table.conversationId)
  })
);
