import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { posts } from "./posts";
import { users } from "./users";

export const contactRequestStatusEnum = pgEnum("contact_request_status", [
  "pending",
  "accepted",
  "rejected",
  "expired",
  "cancelled"
]);

export const contactRequests = pgTable(
  "contact_requests",
  {
    contactRequestId: uuid("contact_request_id").primaryKey().defaultRandom(),
    fromPostId: uuid("from_post_id")
      .notNull()
      .references(() => posts.postId),
    toPostId: uuid("to_post_id")
      .notNull()
      .references(() => posts.postId),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.userId),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.userId),
    status: contactRequestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    recipientStatusIdx: index("idx_contact_requests_recipient_status").on(
      table.recipientUserId,
      table.status,
      table.createdAt
    ),
    requesterStatusIdx: index("idx_contact_requests_requester_status").on(
      table.requesterUserId,
      table.status,
      table.createdAt
    ),
    activePairUq: uniqueIndex("uq_contact_requests_active_pair")
      .on(table.fromPostId, table.toPostId)
      .where(sql`${table.status} in ('pending', 'accepted')`)
  })
);
