import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { communities } from "./communities";
import { anchorStatusEnum } from "./enums";
import { users } from "./users";

export const anchors = pgTable(
  "anchors",
  {
    anchorId: uuid("anchor_id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.userId),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
    orgName: varchar("org_name", { length: 200 }).notNull(),
    contact: varchar("contact", { length: 200 }),
    status: anchorStatusEnum("status").notNull().default("pending_activation"),
    totpSecretCiphertext: text("totp_secret_ciphertext"),
    recoveryCodesHashes: text("recovery_codes_hashes").array(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    lastMfaAt: timestamp("last_mfa_at", { withTimezone: true }),
    roleAssignments: jsonb("role_assignments"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: uniqueIndex("uq_anchors_user").on(table.userId),
    activeCommunityUq: uniqueIndex("uq_anchors_active_community")
      .on(table.communityId)
      .where(sql`${table.status} = 'active'`)
  })
);
