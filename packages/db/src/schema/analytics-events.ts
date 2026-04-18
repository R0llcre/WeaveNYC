import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { communities } from "./communities";

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    eventId: uuid("event_id").primaryKey().defaultRandom(),
    eventType: varchar("event_type", { length: 40 }).notNull(),
    communityId: uuid("community_id").references(() => communities.communityId),
    actorUserIdHash: varchar("actor_user_id_hash", { length: 64 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload"),
  },
  (table) => ({
    typeOccurredIdx: index("idx_analytics_events_type_occurred_at").on(
      table.eventType,
      table.occurredAt.desc(),
    ),
    communityTypeOccurredIdx: index("idx_analytics_events_community_type_occurred_at")
      .on(table.communityId, table.eventType, table.occurredAt.desc())
      .where(sql`${table.communityId} IS NOT NULL`),
  }),
);
