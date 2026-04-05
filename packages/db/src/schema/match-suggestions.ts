import { doublePrecision, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { posts } from "./posts";

export const matchSuggestions = pgTable("match_suggestions", {
  suggestionId: uuid("suggestion_id").primaryKey().defaultRandom(),
  requestPostId: uuid("request_post_id")
    .notNull()
    .references(() => posts.postId),
  candidateType: varchar("candidate_type", { length: 30 }).notNull(),
  candidateId: uuid("candidate_id").notNull(),
  score: doublePrecision("score").notNull(),
  reasons: text("reasons").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
