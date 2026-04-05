import { eq } from "drizzle-orm";

import type { Database } from "../src/client";
import {
  anchors,
  communities,
  communityMembers,
  contactRequests,
  conversations,
  datasetVersions,
  matchSuggestions,
  messages,
  moderationActions,
  posts,
  reports,
  resourceChangeLogs,
  resourceProviders,
  users,
  verificationLogs
} from "../src/schema";
import { seedIds } from "./fixtures";

export async function seedDatabase(db: Database) {
  await db
    .insert(users)
    .values([
      {
        userId: seedIds.anonymousUserId,
        displayName: "Anonymous Demo User",
        preferredLanguages: ["en"],
        homeZip: "11735",
        level: "anonymous",
        status: "active"
      },
      {
        userId: seedIds.verifiedUserId,
        displayName: "Verified Demo User",
        preferredLanguages: ["en", "es"],
        homeZip: "11735",
        level: "verified",
        status: "active",
        phoneHash: "demo_phone_hash"
      },
      {
        userId: seedIds.anchorUserId,
        displayName: "Anchor Demo User",
        preferredLanguages: ["en", "zh"],
        homeZip: "11735",
        level: "anchor",
        status: "active",
        emailHash: "demo_email_hash"
      }
    ])
    .onConflictDoUpdate({
      target: users.userId,
      set: {
        updatedAt: new Date()
      }
    });

  await db
    .insert(communities)
    .values({
      communityId: seedIds.communityId,
      name: "Farmingdale Demo Community",
      centerZip: "11735",
      joinPolicy: "invite_only"
    })
    .onConflictDoUpdate({
      target: communities.communityId,
      set: {
        updatedAt: new Date()
      }
    });

  await db.insert(communityMembers).values([
    {
      userId: seedIds.verifiedUserId,
      communityId: seedIds.communityId
    },
    {
      userId: seedIds.anchorUserId,
      communityId: seedIds.communityId
    }
  ]).onConflictDoNothing();

  await db
    .insert(anchors)
    .values({
      anchorId: seedIds.anchorId,
      communityId: seedIds.communityId,
      orgName: "St. Kilian Parish Social Ministry",
      contact: "demo-anchor@weavenyc.local",
      roleAssignments: {
        admins: [seedIds.anchorUserId],
        mods: [seedIds.anchorUserId]
      }
    })
    .onConflictDoNothing();

  await db
    .insert(datasetVersions)
    .values({
      datasetVersionId: seedIds.datasetVersionId,
      source: "cfc_active",
      datasetVersion: "cfc_active_2026-04-04",
      sourceLabel: "NYC HRA Community Food Connection",
      sourceUrl: "https://example.org/cfc-active.csv",
      recordCount: 1,
      activeRecordCount: 1,
      status: "active",
      checksum: "demo_checksum",
      importStartedAt: new Date("2026-04-04T10:00:00.000Z"),
      importCompletedAt: new Date("2026-04-04T10:05:00.000Z")
    })
    .onConflictDoUpdate({
      target: datasetVersions.datasetVersion,
      set: {
        activeRecordCount: 1,
        updatedAt: new Date()
      }
    });

  await db
    .insert(resourceProviders)
    .values({
      providerId: seedIds.providerId,
      source: "cfc_active",
      sourceRef: "cfc_active:st-kilian-farmingdale",
      name: "St. Kilian Parish Social Ministry",
      type: "pantry",
      addressText: "140 Elizabeth Street, Farmingdale, NY",
      city: "Farmingdale",
      state: "NY",
      zip: "11735",
      phone: "516-756-9656",
      hoursJson: {
        mon: "09:30-12:30",
        tue: "09:30-12:30"
      },
      languages: ["en", "es"],
      eligibilityNotes: "Call ahead for current requirements.",
      lat: 40.7326,
      lng: -73.4454,
      geoPrecision: "street",
      contentHash: "demo_content_hash",
      datasetVersion: "cfc_active_2026-04-04",
      status: "active",
      lastSeenAt: new Date("2026-04-04T10:05:00.000Z"),
      lastVerifiedAt: new Date("2026-04-04T11:00:00.000Z")
    })
    .onConflictDoUpdate({
      target: [resourceProviders.source, resourceProviders.sourceRef, resourceProviders.datasetVersion],
      set: {
        updatedAt: new Date(),
        status: "active"
      }
    });

  await db
    .insert(verificationLogs)
    .values({
      verificationLogId: seedIds.verificationLogId,
      providerId: seedIds.providerId,
      verifier: "seed-script",
      method: "manual_review",
      result: "confirmed",
      notes: "Seed verification entry."
    })
    .onConflictDoNothing();

  await db
    .insert(resourceChangeLogs)
    .values({
      changeLogId: seedIds.changeLogId,
      source: "cfc_active",
      sourceRef: "cfc_active:st-kilian-farmingdale",
      datasetVersion: "cfc_active_2026-04-04",
      changeType: "added",
      changedFields: ["name", "hours_json"],
      contentHashAfter: "demo_content_hash"
    })
    .onConflictDoNothing();

  await db
    .insert(posts)
    .values([
      {
        postId: seedIds.requestPostId,
        postType: "request",
        category: "food",
        title: "Need dinner for 2",
        body: "We are short on food tonight. Anything helps.",
        language: "en",
        locationZip: "11735",
        privacy: "community_only",
        expiresAt: new Date("2026-04-05T03:00:00.000Z"),
        createdBy: seedIds.verifiedUserId,
        communityId: seedIds.communityId,
        status: "active",
        riskLevel: "low",
        verificationState: "unverified",
        contactPref: {
          in_app_chat: true,
          call: false
        }
      },
      {
        postId: seedIds.offerPostId,
        postType: "offer",
        category: "food",
        title: "Can share groceries",
        body: "I have extra groceries available this evening.",
        language: "en",
        locationZip: "11735",
        privacy: "community_only",
        expiresAt: new Date("2026-04-05T05:00:00.000Z"),
        createdBy: seedIds.anchorUserId,
        communityId: seedIds.communityId,
        status: "active",
        riskLevel: "low",
        verificationState: "verified_by_anchor",
        contactPref: {
          in_app_chat: true,
          call: false
        }
      }
    ])
    .onConflictDoUpdate({
      target: posts.postId,
      set: {
        updatedAt: new Date()
      }
    });

  await db
    .insert(matchSuggestions)
    .values({
      suggestionId: seedIds.suggestionId,
      requestPostId: seedIds.requestPostId,
      candidateType: "official_resource",
      candidateId: seedIds.providerId,
      score: 0.82,
      reasons: ["same_zip", "open_today", "pantry"]
    })
    .onConflictDoNothing();

  await db
    .insert(contactRequests)
    .values({
      contactRequestId: seedIds.contactRequestId,
      fromPostId: seedIds.requestPostId,
      toPostId: seedIds.offerPostId,
      requesterUserId: seedIds.verifiedUserId,
      recipientUserId: seedIds.anchorUserId,
      status: "accepted",
      respondedAt: new Date("2026-04-04T12:30:00.000Z"),
      expiresAt: new Date("2026-04-06T12:00:00.000Z")
    })
    .onConflictDoNothing();

  await db
    .insert(conversations)
    .values({
      conversationId: seedIds.conversationId,
      participants: [seedIds.verifiedUserId, seedIds.anchorUserId],
      relatedPostIds: [seedIds.requestPostId, seedIds.offerPostId],
      contactRequestId: seedIds.contactRequestId,
      lastActivityAt: new Date("2026-04-04T12:45:00.000Z")
    })
    .onConflictDoNothing();

  await db
    .insert(messages)
    .values({
      messageId: seedIds.messageId,
      conversationId: seedIds.conversationId,
      senderUserId: seedIds.anchorUserId,
      body: "We can coordinate pickup in-app.",
      safetyFlags: []
    })
    .onConflictDoNothing();

  await db
    .insert(reports)
    .values({
      reportId: seedIds.reportId,
      targetType: "post",
      targetId: seedIds.requestPostId,
      reason: "other",
      detailText: "Seed moderation example.",
      reporterUserId: seedIds.anchorUserId,
      status: "resolved",
      resolution: "none",
      resolvedAt: new Date("2026-04-04T13:00:00.000Z")
    })
    .onConflictDoNothing();

  await db
    .insert(moderationActions)
    .values({
      actionId: seedIds.moderationActionId,
      reportId: seedIds.reportId,
      anchorUserId: seedIds.anchorUserId,
      communityId: seedIds.communityId,
      actionType: "approve",
      targetType: "post",
      targetId: seedIds.requestPostId,
      reason: "No issue found in seed review."
    })
    .onConflictDoNothing();

  const seededUser = await db.query.users.findFirst({
    where: eq(users.userId, seedIds.anonymousUserId)
  });

  return {
    ok: Boolean(seededUser)
  };
}
