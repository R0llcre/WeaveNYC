import { doublePrecision, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { posts } from "./posts";

export const matchSuggestions = pgTable("match_suggestions", {
  suggestionId: uuid("suggestion_id").primaryKey().defaultRandom(),
  requestPostId: uuid("request_post_id")
    .notNull()
    .references(() => posts.postId),
  batchNumber: integer("batch_number").notNull().default(1),
  position: integer("position").notNull().default(1),
  candidateType: varchar("candidate_type", { length: 30 }).notNull(),
  candidateId: uuid("candidate_id").notNull(),
  score: doublePrecision("score").notNull(),
  reasons: text("reasons").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  requestBatchPositionUq: uniqueIndex("uq_match_suggestions_request_batch_position").on(
    table.requestPostId,
    table.batchNumber,
    table.position
  ),
  requestCandidateUq: uniqueIndex("uq_match_suggestions_request_candidate").on(
    table.requestPostId,
    table.candidateType,
    table.candidateId
  ),
  requestBatchIdx: index("idx_match_suggestions_request_batch").on(
    table.requestPostId,
    table.batchNumber,
    table.position
  )
}));
