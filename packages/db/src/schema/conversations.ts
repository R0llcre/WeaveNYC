import { pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { contactRequests } from "./contact-requests";

export const conversations = pgTable(
  "conversations",
  {
    conversationId: uuid("conversation_id").primaryKey().defaultRandom(),
    participants: uuid("participants").array().notNull(),
    relatedPostIds: uuid("related_post_ids").array(),
    contactRequestId: uuid("contact_request_id")
      .notNull()
      .references(() => contactRequests.contactRequestId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    contactRequestUq: uniqueIndex("uq_conversations_contact_request_id").on(table.contactRequestId)
  })
);
