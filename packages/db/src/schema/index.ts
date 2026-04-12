import { sql } from "drizzle-orm";
import {
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const userLevelEnum = pgEnum("user_level", ["anonymous", "verified", "anchor"]);
export const joinPolicyEnum = pgEnum("join_policy", ["invite_only", "open"]);
export const communityAccessChannelEnum = pgEnum("community_access_channel", [
  "invite_code",
  "qr_token"
]);
export const communityAccessCodeStatusEnum = pgEnum("community_access_code_status", [
  "active",
  "revoked"
]);
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
export const verificationStateEnum = pgEnum("verification_state", [
  "unverified",
  "verified_by_anchor",
  "verified_by_witnesses"
]);
export const languageEnum = pgEnum("language", ["en", "es", "zh"]);
export const datasetVersionStatusEnum = pgEnum("dataset_version_status", [
  "importing",
  "active",
  "superseded",
  "failed"
]);
export const resourceStatusEnum = pgEnum("resource_status", ["active", "inactive"]);
export const contactRequestStatusEnum = pgEnum("contact_request_status", [
  "pending",
  "accepted",
  "rejected",
  "expired",
  "cancelled"
]);
export const conversationStatusEnum = pgEnum("conversation_status", ["active", "closed", "blocked"]);
export const reportStatusEnum = pgEnum("report_status", [
  "new",
  "in_review",
  "resolved",
  "dismissed"
]);
export const reportReasonEnum = pgEnum("report_reason", [
  "harassment",
  "scam",
  "misinformation",
  "unsafe_behavior",
  "other"
]);
export const resolutionEnum = pgEnum("resolution", [
  "remove_post",
  "suspend_user",
  "warn",
  "none"
]);

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const communities = pgTable("communities", {
  communityId: uuid("community_id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  centerZip: varchar("center_zip", { length: 10 }).notNull(),
  joinPolicy: joinPolicyEnum("join_policy").notNull().default("invite_only"),
  rulesetId: uuid("ruleset_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const communityMembers = pgTable(
  "community_members",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    communityMemberPk: primaryKey({ columns: [table.userId, table.communityId] })
  })
);

export const communityAccessCodes = pgTable(
  "community_access_codes",
  {
    accessCodeId: uuid("access_code_id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.communityId),
    channel: communityAccessChannelEnum("channel").notNull(),
    code: varchar("code", { length: 140 }).notNull(),
    status: communityAccessCodeStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    communityStatusIdx: index("idx_community_access_codes_community_status").on(
      table.communityId,
      table.status,
      table.channel
    ),
    codeLookupIdx: index("idx_community_access_codes_channel_code").on(table.channel, table.code),
    activeChannelCodeUq: uniqueIndex("uq_community_access_codes_active_channel_code")
      .on(table.channel, table.code)
      .where(sql`${table.status} = 'active'`)
  })
);

export const anchors = pgTable("anchors", {
  anchorId: uuid("anchor_id").primaryKey().defaultRandom(),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.communityId),
  orgName: varchar("org_name", { length: 200 }).notNull(),
  contact: varchar("contact", { length: 200 }),
  roleAssignments: jsonb("role_assignments"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

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
    verificationState: verificationStateEnum("verification_state")
      .notNull()
      .default("unverified"),
    contactPref: jsonb("contact_pref"),
    ipfsCid: varchar("ipfs_cid", { length: 100 }),
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

export const datasetVersions = pgTable(
  "dataset_versions",
  {
    datasetVersionId: uuid("dataset_version_id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(),
    datasetVersion: varchar("dataset_version", { length: 50 }).notNull(),
    sourceLabel: varchar("source_label", { length: 120 }),
    sourceUrl: text("source_url"),
    recordCount: integer("record_count").notNull(),
    activeRecordCount: integer("active_record_count").notNull().default(0),
    status: datasetVersionStatusEnum("status").notNull().default("importing"),
    checksum: varchar("checksum", { length: 64 }),
    importStartedAt: timestamp("import_started_at", { withTimezone: true }).notNull(),
    importCompletedAt: timestamp("import_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    datasetSourceUq: uniqueIndex("uq_dataset_versions_source_version").on(
      table.source,
      table.datasetVersion
    )
  })
);

export const resourceProviders = pgTable(
  "resource_providers",
  {
    providerId: uuid("provider_id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(),
    sourceRef: varchar("source_ref", { length: 200 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    addressText: text("address_text").notNull(),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zip: varchar("zip", { length: 10 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    hoursJson: jsonb("hours_json"),
    languages: text("languages").array(),
    eligibilityNotes: text("eligibility_notes"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    geoPrecision: varchar("geo_precision", { length: 20 }).default("zip_centroid"),
    contentHash: varchar("content_hash", { length: 64 }),
    datasetVersion: varchar("dataset_version", { length: 50 }).notNull(),
    status: resourceStatusEnum("status").notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    zipTypeIdx: index("idx_resources_zip_type").on(table.zip, table.type),
    sourceRefIdx: index("idx_resources_source_ref").on(table.source, table.sourceRef),
    datasetStatusIdx: index("idx_resources_dataset_status").on(
      table.datasetVersion,
      table.status
    ),
    sourceDatasetVersionFk: foreignKey({
      columns: [table.source, table.datasetVersion],
      foreignColumns: [datasetVersions.source, datasetVersions.datasetVersion],
      name: "fk_resource_providers_source_dataset_version"
    }),
    activeSourceRefUq: uniqueIndex("uq_resources_active_source_ref")
      .on(table.source, table.sourceRef)
      .where(sql`${table.status} = 'active'`),
    sourceRefVersionUq: uniqueIndex("uq_resources_source_ref_version").on(
      table.source,
      table.sourceRef,
      table.datasetVersion
    )
  })
);

export const resourceChangeLogs = pgTable(
  "resource_change_logs",
  {
    changeLogId: uuid("change_log_id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(),
    sourceRef: varchar("source_ref", { length: 200 }).notNull(),
    datasetVersion: varchar("dataset_version", { length: 50 }).notNull(),
    changeType: varchar("change_type", { length: 20 }).notNull(),
    changedFields: text("changed_fields").array(),
    contentHashBefore: varchar("content_hash_before", { length: 64 }),
    contentHashAfter: varchar("content_hash_after", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sourceDatasetVersionFk: foreignKey({
      columns: [table.source, table.datasetVersion],
      foreignColumns: [datasetVersions.source, datasetVersions.datasetVersion],
      name: "fk_resource_change_logs_source_dataset_version"
    })
  })
);

export const verificationLogs = pgTable("verification_logs", {
  verificationLogId: uuid("verification_log_id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => resourceProviders.providerId),
  verifier: varchar("verifier", { length: 100 }).notNull(),
  method: varchar("method", { length: 30 }).notNull(),
  result: varchar("result", { length: 30 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const matchSuggestions = pgTable(
  "match_suggestions",
  {
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
  },
  (table) => ({
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
  })
);

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
    activePairUq: uniqueIndex("uq_contact_requests_active_pair").on(
      table.fromPostId,
      table.toPostId
    ).where(sql`${table.status} in ('pending', 'accepted')`)
  })
);

export const conversations = pgTable(
  "conversations",
  {
    conversationId: uuid("conversation_id").primaryKey().defaultRandom(),
    participants: uuid("participants").array().notNull(),
    relatedPostIds: uuid("related_post_ids").array(),
    contactRequestId: uuid("contact_request_id")
      .notNull()
      .references(() => contactRequests.contactRequestId),
    status: conversationStatusEnum("status").notNull().default("active"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    blockedByUserId: uuid("blocked_by_user_id").references(() => users.userId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    contactRequestUq: uniqueIndex("uq_conversations_contact_request_id").on(
      table.contactRequestId
    ),
    lastActivityIdx: index("idx_conversations_last_activity").on(table.lastActivityAt, table.conversationId)
  })
);

export const messages = pgTable(
  "messages",
  {
    messageId: uuid("message_id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.conversationId),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.userId),
    body: text("body").notNull(),
    safetyFlags: text("safety_flags").array(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    conversationIdx: index("idx_messages_conversation").on(
      table.conversationId,
      table.sentAt
    ),
    senderSentAtIdx: index("idx_messages_sender_sent_at").on(table.senderUserId, table.sentAt)
  })
);

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    conversationReadPk: primaryKey({
      columns: [table.conversationId, table.userId],
      name: "pk_conversation_reads"
    })
  })
);

export const blocks = pgTable(
  "blocks",
  {
    blockId: uuid("block_id").primaryKey().defaultRandom(),
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.userId),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.userId),
    conversationId: uuid("conversation_id").references(() => conversations.conversationId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    blockerIdx: index("idx_blocks_blocker").on(table.blockerUserId, table.createdAt),
    blockedIdx: index("idx_blocks_blocked").on(table.blockedUserId, table.createdAt),
    pairUq: uniqueIndex("uq_blocks_pair").on(table.blockerUserId, table.blockedUserId)
  })
);

export const reports = pgTable("reports", {
  reportId: uuid("report_id").primaryKey().defaultRandom(),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.communityId),
  targetType: varchar("target_type", { length: 20 }).notNull(),
  targetId: uuid("target_id").notNull(),
  reason: reportReasonEnum("reason").notNull(),
  detailText: text("detail_text"),
  reporterUserId: uuid("reporter_user_id")
    .notNull()
    .references(() => users.userId),
  status: reportStatusEnum("status").notNull().default("new"),
  resolution: resolutionEnum("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
}, (table) => ({
  communityCreatedIdx: index("idx_reports_community_created_at").on(table.communityId, table.createdAt)
}));

export const moderationActions = pgTable("moderation_actions", {
  actionId: uuid("action_id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").references(() => reports.reportId),
  anchorUserId: uuid("anchor_user_id")
    .notNull()
    .references(() => users.userId),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.communityId),
  actionType: varchar("action_type", { length: 30 }).notNull(),
  targetType: varchar("target_type", { length: 20 }).notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const schema = {
  users,
  communities,
  communityMembers,
  communityAccessCodes,
  anchors,
  posts,
  datasetVersions,
  resourceProviders,
  resourceChangeLogs,
  verificationLogs,
  matchSuggestions,
  contactRequests,
  conversations,
  messages,
  conversationReads,
  blocks,
  reports,
  moderationActions
};
