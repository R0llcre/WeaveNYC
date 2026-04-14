import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { communities } from "./communities";
import { users } from "./users";

export const postTypeEnum = pgEnum("post_type", ["request", "offer"]);
export const categoryEnum = pgEnum("category", [
  "food",
  "goods",
  "childcare",
  "companionship",
  "translation",
  "transportation",
  "other"
]);
export const privacyEnum = pgEnum("privacy", ["community_only", "public", "anchor_mediated"]);
export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "pending_review",
  "active",
  "fulfilled",
  "closed",
  "removed"
]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);
export const verificationEnum = pgEnum("verification_state", [
  "unverified",
  "verified_by_anchor",
  "verified_by_witnesses"
]);
export const languageEnum = pgEnum("language", ["en", "es", "zh"]);

export const posts = pgTable(
  "posts",
  {
    postId: uuid("post_id").primaryKey().defaultRandom(),
    postType: postTypeEnum("post_type").notNull(),
    category: categoryEnum("category").notNull(),
    title: varchar("title", { length: 60 }).notNull(),
    body: text("body").notNull(),
    language: languageEnum("language").notNull().default("en"),
    locationZip: varchar("location_zip", { length: 10 }).notNull(),
    privacy: privacyEnum("privacy").notNull().default("community_only"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.userId),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
    status: postStatusEnum("status").notNull().default("draft"),
    riskLevel: riskLevelEnum("risk_level").notNull().default("low"),
    verificationState: verificationEnum("verification_state").notNull().default("unverified"),
    contactPref: jsonb("contact_pref"),
    ipfsCid: varchar("ipfs_cid", { length: 100 }),
    p2pVersion: integer("p2p_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    communityStatusIdx: index("idx_posts_community_status").on(
      table.communityId,
      table.status,
      table.category,
      table.expiresAt
    ),
    communityZipIdx: index("idx_posts_community_zip").on(
      table.communityId,
      table.locationZip,
      table.status,
      table.expiresAt
    ),
    createdByIdx: index("idx_posts_created_by").on(table.createdBy)
  })
);
