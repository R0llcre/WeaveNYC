import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { communities } from "./communities";
import { announcementPinStrategyEnum } from "./enums";
import { users } from "./users";

const validReviewCategoriesSql = sql`review_categories <@ array['food', 'goods', 'childcare', 'companionship', 'translation', 'transportation', 'other']::text[]`;
const validLanguagePreferencesSql = sql`language_preferences <@ array['en', 'es', 'zh']::text[]`;
const validAutoHideThresholdSql = sql`auto_hide_report_threshold between 1 and 20`;

export const communityRulesets = pgTable(
  "community_rulesets",
  {
    rulesetId: uuid("ruleset_id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
    reviewCategories: text("review_categories").array().notNull().default(sql`'{}'::text[]`),
    autoHideReportThreshold: integer("auto_hide_report_threshold").notNull().default(3),
    keywordBlocklist: text("keyword_blocklist").array().notNull().default(sql`'{}'::text[]`),
    languagePreferences: text("language_preferences").array().notNull().default(sql`'{}'::text[]`),
    announcementPinStrategy: announcementPinStrategyEnum("announcement_pin_strategy")
      .notNull()
      .default("latest"),
    createdBy: uuid("created_by").references(() => users.userId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    communityRulesetUq: uniqueIndex("uq_community_rulesets_community").on(table.communityId),
    reviewCategoriesCheck: check(
      "chk_community_rulesets_review_categories_valid",
      validReviewCategoriesSql
    ),
    languagePreferencesCheck: check(
      "chk_community_rulesets_language_preferences_valid",
      validLanguagePreferencesSql
    ),
    autoHideThresholdCheck: check(
      "chk_community_rulesets_auto_hide_report_threshold",
      validAutoHideThresholdSql
    )
  })
);
