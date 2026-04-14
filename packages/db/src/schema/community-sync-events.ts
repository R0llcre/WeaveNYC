import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { communities } from "./communities";
import { users } from "./users";

export const communitySyncEvents = pgTable(
  "community_sync_events",
  {
    syncEventId: uuid("sync_event_id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 40 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.userId),
    actorP2pId: varchar("actor_p2p_id", { length: 120 }),
    payloadJson: jsonb("payload_json").notNull(),
    cid: varchar("cid", { length: 100 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    communityOccurredIdx: index("idx_community_sync_events_community_occurred_at").on(
      table.communityId,
      table.occurredAt,
    ),
    aggregateOccurredIdx: index("idx_community_sync_events_aggregate_occurred_at").on(
      table.aggregateType,
      table.aggregateId,
      table.occurredAt,
    ),
  }),
);
