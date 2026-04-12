import { and, eq, ne, sql } from "drizzle-orm";

import type { Database } from "../src/client";
import {
  anchorInvites,
  anchors,
  announcements,
  communities,
  communityAccessCodes,
  communityMembers,
  communityRulesets,
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
import { seedIds, seedValues } from "./fixtures";

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
        phoneHash: "demo_phone_hash",
        phoneHashSalt: "demo_phone_salt"
      },
      {
        userId: seedIds.anchorUserId,
        displayName: "Anchor Demo User",
        preferredLanguages: ["en", "zh"],
        homeZip: "11735",
        level: "anchor",
        status: "active",
        emailHash: "demo_email_hash",
        emailHashSalt: "demo_email_salt"
      }
    ])
    .onConflictDoUpdate({
      target: users.userId,
      set: {
        displayName: sql`excluded.display_name`,
        preferredLanguages: sql`excluded.preferred_languages`,
        homeZip: sql`excluded.home_zip`,
        phoneHash: sql`excluded.phone_hash`,
        phoneHashSalt: sql`excluded.phone_hash_salt`,
        emailHash: sql`excluded.email_hash`,
        emailHashSalt: sql`excluded.email_hash_salt`,
        level: sql`excluded.level`,
        status: sql`excluded.status`,
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
        name: sql`excluded.name`,
        centerZip: sql`excluded.center_zip`,
        joinPolicy: sql`excluded.join_policy`,
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
    .insert(communityAccessCodes)
    .values([
      {
        accessCodeId: seedIds.inviteAccessCodeId,
        communityId: seedIds.communityId,
        channel: "invite_code",
        code: seedValues.communityInviteCode,
        status: "active"
      },
      {
        accessCodeId: seedIds.qrAccessCodeId,
        communityId: seedIds.communityId,
        channel: "qr_token",
        code: seedValues.communityQrToken,
        status: "active"
      }
    ])
    .onConflictDoUpdate({
      target: communityAccessCodes.accessCodeId,
      set: {
        communityId: sql`excluded.community_id`,
        channel: sql`excluded.channel`,
        code: sql`excluded.code`,
        status: sql`excluded.status`,
        expiresAt: sql`excluded.expires_at`
      }
    })

  await db
    .insert(communityRulesets)
    .values({
      rulesetId: seedIds.rulesetId,
      communityId: seedIds.communityId,
      reviewCategories: ["transportation"],
      autoHideReportThreshold: 2,
      keywordBlocklist: ["cash only"],
      languagePreferences: ["en", "es", "zh"],
      announcementPinStrategy: "manual",
      createdBy: seedIds.anchorUserId
    })
    .onConflictDoUpdate({
      target: communityRulesets.rulesetId,
      set: {
        communityId: sql`excluded.community_id`,
        reviewCategories: sql`excluded.review_categories`,
        autoHideReportThreshold: sql`excluded.auto_hide_report_threshold`,
        keywordBlocklist: sql`excluded.keyword_blocklist`,
        languagePreferences: sql`excluded.language_preferences`,
        announcementPinStrategy: sql`excluded.announcement_pin_strategy`,
        createdBy: sql`excluded.created_by`,
        updatedAt: new Date()
      }
    });

  await db
    .update(communities)
    .set({
      rulesetId: seedIds.rulesetId,
      updatedAt: new Date()
    })
    .where(eq(communities.communityId, seedIds.communityId));

  await db
    .insert(anchorInvites)
    .values({
      anchorInviteId: seedIds.anchorInviteId,
      communityId: seedIds.communityId,
      codeHash: seedValues.anchorInviteCodeHash,
      orgName: "St. Kilian Parish Social Ministry",
      status: "active",
      expiresAt: new Date("2026-05-01T00:00:00.000Z")
    })
    .onConflictDoUpdate({
      target: anchorInvites.anchorInviteId,
      set: {
        communityId: sql`excluded.community_id`,
        codeHash: sql`excluded.code_hash`,
        orgName: sql`excluded.org_name`,
        status: sql`excluded.status`,
        expiresAt: sql`excluded.expires_at`,
        consumedByUserId: null,
        consumedAt: null
      }
    });

  await db
    .insert(anchors)
    .values({
      anchorId: seedIds.anchorId,
      userId: seedIds.anchorUserId,
      communityId: seedIds.communityId,
      orgName: "St. Kilian Parish Social Ministry",
      contact: "demo-anchor@weavenyc.local",
      status: "active",
      totpSecretCiphertext: seedValues.anchorTotpSecretCiphertext,
      recoveryCodesHashes: [...seedValues.anchorRecoveryCodeHashes],
      activatedAt: new Date("2026-04-04T11:30:00.000Z"),
      lastMfaAt: new Date("2026-04-04T11:45:00.000Z"),
      roleAssignments: {
        admins: [seedIds.anchorUserId],
        mods: [seedIds.anchorUserId]
      }
    })
    .onConflictDoUpdate({
      target: anchors.anchorId,
      set: {
        userId: sql`excluded.user_id`,
        communityId: sql`excluded.community_id`,
        orgName: sql`excluded.org_name`,
        contact: sql`excluded.contact`,
        status: sql`excluded.status`,
        totpSecretCiphertext: sql`excluded.totp_secret_ciphertext`,
        recoveryCodesHashes: sql`excluded.recovery_codes_hashes`,
        activatedAt: sql`excluded.activated_at`,
        lastMfaAt: sql`excluded.last_mfa_at`,
        roleAssignments: sql`excluded.role_assignments`
      }
    });

  await db
    .insert(datasetVersions)
    .values({
      datasetVersionId: seedIds.datasetVersionId,
      source: "cfc_active",
      datasetVersion: seedValues.datasetVersion,
      sourceLabel: seedValues.datasetSourceLabel,
      sourceUrl: seedValues.datasetSourceUrl,
      recordCount: 1,
      activeRecordCount: 1,
      status: "active",
      checksum: seedValues.datasetChecksum,
      importStartedAt: new Date("2026-04-04T10:00:00.000Z"),
      importCompletedAt: new Date("2026-04-04T10:05:00.000Z")
    })
    .onConflictDoUpdate({
      target: [datasetVersions.source, datasetVersions.datasetVersion],
      set: {
        sourceLabel: sql`excluded.source_label`,
        sourceUrl: sql`excluded.source_url`,
        recordCount: sql`excluded.record_count`,
        activeRecordCount: 1,
        status: sql`excluded.status`,
        checksum: sql`excluded.checksum`,
        importStartedAt: sql`excluded.import_started_at`,
        importCompletedAt: sql`excluded.import_completed_at`,
        updatedAt: new Date()
      }
    });

  const resourceRows = [
    {
      providerId: seedIds.providerId,
      sourceRef: "cfc_active:st-kilian-farmingdale",
      name: "St. Kilian Parish Social Ministry",
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
      contentHash: "demo_content_hash",
    },
    {
      providerId: seedIds.providerId2,
      sourceRef: "cfc_active:hope-for-the-future-farmingdale",
      name: "Hope for the Future",
      addressText: "131 Verdi Street, Farmingdale, NY",
      city: "Farmingdale",
      state: "NY",
      zip: "11735",
      phone: "(631)752-5771",
      hoursJson: {
        thu: "16:00-18:00"
      },
      languages: ["en"],
      eligibilityNotes: "Evening pantry support.",
      lat: 40.7132,
      lng: -73.4172,
      contentHash: "demo_content_hash_2",
    },
    {
      providerId: seedIds.providerId3,
      sourceRef: "cfc_active:st-martin-bethpage",
      name: "St. Martin of Tours - Bethpage",
      addressText: "208 Broadway, Bethpage, NY",
      city: "Bethpage",
      state: "NY",
      zip: "11714",
      phone: "(516)931-7332",
      hoursJson: {
        mon: "09:00-12:00",
        thu: "09:00-12:00"
      },
      languages: ["en"],
      eligibilityNotes: "Nearby pantry support.",
      lat: 40.7383,
      lng: -73.4792,
      contentHash: "demo_content_hash_3",
    }
  ];

  for (const resourceRow of resourceRows) {
    await db
      .update(resourceProviders)
      .set({
        status: "inactive",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(resourceProviders.source, "cfc_active"),
          eq(resourceProviders.sourceRef, resourceRow.sourceRef),
          ne(resourceProviders.providerId, resourceRow.providerId),
          sql`${resourceProviders.status} = 'active'`
        )
      );

    await db
      .insert(resourceProviders)
      .values({
        providerId: resourceRow.providerId,
        source: "cfc_active",
        sourceRef: resourceRow.sourceRef,
        name: resourceRow.name,
        type: "pantry",
        addressText: resourceRow.addressText,
        city: resourceRow.city,
        state: resourceRow.state,
        zip: resourceRow.zip,
        phone: resourceRow.phone,
        hoursJson: resourceRow.hoursJson,
        languages: resourceRow.languages,
        eligibilityNotes: resourceRow.eligibilityNotes,
        lat: resourceRow.lat,
        lng: resourceRow.lng,
        geoPrecision: "street",
        contentHash: resourceRow.contentHash,
        datasetVersion: seedValues.datasetVersion,
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
  }

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
      datasetVersion: seedValues.datasetVersion,
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
      },
      {
        postId: seedIds.pendingReviewPostId,
        postType: "offer",
        category: "transportation",
        title: "Can drive a neighbor to the pantry",
        body: "Verified helper can drive someone after school hours.",
        language: "en",
        locationZip: "11735",
        privacy: "community_only",
        expiresAt: new Date("2026-04-06T05:00:00.000Z"),
        createdBy: seedIds.verifiedUserId,
        communityId: seedIds.communityId,
        status: "pending_review",
        riskLevel: "high",
        verificationState: "verified_by_anchor",
        contactPref: {
          in_app_chat: true,
          call: true
        }
      }
    ])
    .onConflictDoUpdate({
      target: posts.postId,
      set: {
        title: sql`excluded.title`,
        body: sql`excluded.body`,
        language: sql`excluded.language`,
        locationZip: sql`excluded.location_zip`,
        privacy: sql`excluded.privacy`,
        expiresAt: sql`excluded.expires_at`,
        createdBy: sql`excluded.created_by`,
        communityId: sql`excluded.community_id`,
        status: sql`excluded.status`,
        riskLevel: sql`excluded.risk_level`,
        verificationState: sql`excluded.verification_state`,
        contactPref: sql`excluded.contact_pref`,
        updatedAt: new Date()
      }
    });

  await db
    .insert(matchSuggestions)
    .values({
      suggestionId: seedIds.suggestionId,
      requestPostId: seedIds.requestPostId,
      batchNumber: 1,
      position: 1,
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
    .onConflictDoUpdate({
      target: contactRequests.contactRequestId,
      set: {
        fromPostId: sql`excluded.from_post_id`,
        toPostId: sql`excluded.to_post_id`,
        requesterUserId: sql`excluded.requester_user_id`,
        recipientUserId: sql`excluded.recipient_user_id`,
        status: sql`excluded.status`,
        respondedAt: sql`excluded.responded_at`,
        expiresAt: sql`excluded.expires_at`
      }
    });

  await db
    .insert(conversations)
    .values({
      conversationId: seedIds.conversationId,
      participants: [seedIds.verifiedUserId, seedIds.anchorUserId],
      relatedPostIds: [seedIds.requestPostId, seedIds.offerPostId],
      contactRequestId: seedIds.contactRequestId,
      lastActivityAt: new Date("2026-04-04T12:45:00.000Z")
    })
    .onConflictDoUpdate({
      target: conversations.conversationId,
      set: {
        participants: sql`excluded.participants`,
        relatedPostIds: sql`excluded.related_post_ids`,
        contactRequestId: sql`excluded.contact_request_id`,
        status: "active",
        closedAt: null,
        blockedAt: null,
        blockedByUserId: null,
        lastActivityAt: sql`excluded.last_activity_at`
      }
    });

  await db
    .insert(messages)
    .values({
      messageId: seedIds.messageId,
      conversationId: seedIds.conversationId,
      senderUserId: seedIds.anchorUserId,
      body: "We can coordinate pickup in-app.",
      safetyFlags: []
    })
    .onConflictDoUpdate({
      target: messages.messageId,
      set: {
        conversationId: sql`excluded.conversation_id`,
        senderUserId: sql`excluded.sender_user_id`,
        body: sql`excluded.body`,
        safetyFlags: sql`excluded.safety_flags`
      }
    });

  await db
    .insert(announcements)
    .values({
      announcementId: seedIds.announcementId,
      communityId: seedIds.communityId,
      title: seedValues.announcementTitle,
      body: seedValues.announcementBody,
      status: "active",
      isPinned: true,
      createdBy: seedIds.anchorUserId,
      publishedAt: new Date("2026-04-04T14:00:00.000Z")
    })
    .onConflictDoUpdate({
      target: announcements.announcementId,
      set: {
        communityId: sql`excluded.community_id`,
        title: sql`excluded.title`,
        body: sql`excluded.body`,
        status: sql`excluded.status`,
        isPinned: sql`excluded.is_pinned`,
        createdBy: sql`excluded.created_by`,
        publishedAt: sql`excluded.published_at`,
        updatedAt: new Date(),
        deletedAt: null
      }
    });

  await db
    .insert(reports)
    .values({
      reportId: seedIds.reportId,
      communityId: seedIds.communityId,
      targetType: "post",
      targetId: seedIds.offerPostId,
      reason: "scam",
      detailText: "Potential scam language in the offer details.",
      conversationId: seedIds.conversationId,
      reporterUserId: seedIds.verifiedUserId,
      status: "new",
      resolution: null,
      resolvedAt: null
    })
    .onConflictDoUpdate({
      target: reports.reportId,
      set: {
        communityId: sql`excluded.community_id`,
        targetType: sql`excluded.target_type`,
        targetId: sql`excluded.target_id`,
        reason: sql`excluded.reason`,
        detailText: sql`excluded.detail_text`,
        conversationId: sql`excluded.conversation_id`,
        reporterUserId: sql`excluded.reporter_user_id`,
        status: sql`excluded.status`,
        resolution: null,
        resolvedAt: null
      }
    });

  await db
    .insert(reports)
    .values({
      reportId: seedIds.resolvedReportId,
      communityId: seedIds.communityId,
      targetType: "message",
      targetId: seedIds.messageId,
      reason: "other",
      detailText: "Seed moderation example that was already resolved.",
      conversationId: seedIds.conversationId,
      reporterUserId: seedIds.verifiedUserId,
      status: "resolved",
      resolution: "warn",
      resolvedAt: new Date("2026-04-04T13:00:00.000Z")
    })
    .onConflictDoUpdate({
      target: reports.reportId,
      set: {
        communityId: sql`excluded.community_id`,
        targetType: sql`excluded.target_type`,
        targetId: sql`excluded.target_id`,
        reason: sql`excluded.reason`,
        detailText: sql`excluded.detail_text`,
        conversationId: sql`excluded.conversation_id`,
        reporterUserId: sql`excluded.reporter_user_id`,
        status: sql`excluded.status`,
        resolution: sql`excluded.resolution`,
        resolvedAt: sql`excluded.resolved_at`
      }
    });

  await db
    .insert(moderationActions)
    .values({
      actionId: seedIds.moderationActionId,
      reportId: seedIds.resolvedReportId,
      anchorUserId: seedIds.anchorUserId,
      communityId: seedIds.communityId,
      actionType: "warn",
      targetType: "message",
      targetId: seedIds.messageId,
      reason: "Seed moderation action for resolved report."
    })
    .onConflictDoUpdate({
      target: moderationActions.actionId,
      set: {
        reportId: sql`excluded.report_id`,
        anchorUserId: sql`excluded.anchor_user_id`,
        communityId: sql`excluded.community_id`,
        actionType: sql`excluded.action_type`,
        targetType: sql`excluded.target_type`,
        targetId: sql`excluded.target_id`,
        reason: sql`excluded.reason`
      }
    });

  const seededUser = await db.query.users.findFirst({
    where: eq(users.userId, seedIds.anonymousUserId)
  });

  return {
    ok: Boolean(seededUser)
  };
}
