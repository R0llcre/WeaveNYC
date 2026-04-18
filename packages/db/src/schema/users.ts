import { pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const userLevelEnum = pgEnum("user_level", ["anonymous", "verified", "anchor"]);

export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  displayName: varchar("display_name", { length: 50 }),
  preferredLanguages: text("preferred_languages").array(),
  homeZip: varchar("home_zip", { length: 10 }),
  phoneHash: varchar("phone_hash", { length: 64 }),
  phoneHashSalt: varchar("phone_hash_salt", { length: 64 }),
  emailHash: varchar("email_hash", { length: 64 }),
  emailHashSalt: varchar("email_hash_salt", { length: 64 }),
  level: userLevelEnum("level").notNull().default("anonymous"),
  status: userStatusEnum("status").notNull().default("active"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletionReason: varchar("deletion_reason", { length: 40 }),
  purgeAt: timestamp("purge_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
