import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { conversations } from "./conversations";
import { users } from "./users";

export const messages = pgTable(
  "messages",
  {
    messageId: uuid("message_id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.conversationId),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.userId),
    body: text("body").notNull(),
    safetyFlags: text("safety_flags").array(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    conversationIdx: index("idx_messages_conversation").on(table.conversationId, table.sentAt)
  })
);
