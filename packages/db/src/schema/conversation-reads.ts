import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { conversations } from "./conversations";
import { messages } from "./messages";
import { users } from "./users";

export const conversationReads = pgTable(
  "conversation_reads",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.conversationId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    lastReadMessageId: uuid("last_read_message_id").references(() => messages.messageId),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.conversationId, table.userId],
      name: "pk_conversation_reads",
    }),
  }),
);
