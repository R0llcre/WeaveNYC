import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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
import { seedDemoPersonas } from "./demo-personas";
import { dedupe } from "../public-ingest/dedup";
import type {
  IngestResult,
  ResourceProviderSeed
} from "../public-ingest/types";
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

  await seedPilotCommunity(db, queensPilot);
  await seedPilotCommunity(db, bronxPilot);

  // Demo-persona seed (B5/B6) — gated on SEED_DEMO_PERSONAS=1 so the
  // default dev seed stays lean. Relies on Queens + Farmingdale
  // communities being present, which they are after the blocks above.
  if (process.env.SEED_DEMO_PERSONAS === "1") {
    await seedDemoPersonas(db);
  }

  // Public-source ingest (B2/B3/B4) — gated on SEED_PUBLIC_SOURCES=1 so
  // the default dev seed doesn't pull the 43-row public snapshot. Ships
  // Food Help NYC + USDA SNAP + DFTA + HRSA with attribution baked in.
  if (process.env.SEED_PUBLIC_SOURCES === "1") {
    await seedPublicSources(db);
  }

  const seededUser = await db.query.users.findFirst({
    where: eq(users.userId, seedIds.anonymousUserId)
  });

  return {
    ok: Boolean(seededUser)
  };
}

/**
 * Load the latest public-ingest snapshot (or a live-run output if present)
 * and upsert rows into `resource_providers`. Curated fixtures always win in
 * `dedupe`, so this pass NEVER overwrites the hand-curated pilot providers.
 * A per-source `dataset_versions` row is emitted so M1 read paths can surface
 * attribution correctly.
 *
 * Gated on `SEED_PUBLIC_SOURCES === "1"` — keep the default seed behavior
 * fast and deterministic for CI.
 */
async function seedPublicSources(db: Database): Promise<void> {
  const seedGeneratedDir = path.resolve(__dirname, "generated");
  const candidates = [
    path.join(seedGeneratedDir, "public-resources.json"),
    path.join(seedGeneratedDir, "public-resources.snapshot.json")
  ];
  const existingPath = candidates.find((candidate) => existsSync(candidate));
  if (!existingPath) {
    process.stdout.write(
      "[seed] SEED_PUBLIC_SOURCES=1 but no public-resources.{json,snapshot.json} found — skipping public ingest step.\n"
    );
    return;
  }

  const payload = JSON.parse(readFileSync(existingPath, "utf8")) as IngestResult;
  if (!payload || !Array.isArray(payload.rows) || payload.rows.length === 0) {
    return;
  }

  // Merge public rows with the curated fixture sources so curated rows win
  // any name/zip/phone collision.
  const curatedProxy: ResourceProviderSeed[] = [];
  const merged = dedupe([...curatedProxy, ...payload.rows]);

  const bySource = merged.reduce<Record<string, ResourceProviderSeed[]>>((acc, row) => {
    (acc[row.source] ??= []).push(row);
    return acc;
  }, {});

  for (const summary of payload.sources) {
    const rowsForSource = bySource[summary.sourceId] ?? [];
    await db
      .insert(datasetVersions)
      .values({
        source: summary.sourceId,
        datasetVersion: summary.datasetVersion,
        sourceLabel: summary.sourceLabel,
        sourceUrl: summary.sourceUrl,
        recordCount: rowsForSource.length,
        activeRecordCount: rowsForSource.length,
        status: "active",
        importStartedAt: new Date(payload.generatedAt),
        importCompletedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [datasetVersions.source, datasetVersions.datasetVersion],
        set: {
          sourceLabel: sql`excluded.source_label`,
          sourceUrl: sql`excluded.source_url`,
          recordCount: sql`excluded.record_count`,
          activeRecordCount: sql`excluded.active_record_count`,
          status: sql`excluded.status`,
          importCompletedAt: sql`excluded.import_completed_at`,
          updatedAt: new Date()
        }
      });

    for (const row of rowsForSource) {
      await db
        .insert(resourceProviders)
        .values({
          source: row.source,
          sourceRef: row.sourceRef,
          name: row.name,
          type: row.type,
          addressText: row.addressText,
          city: row.city ?? null,
          state: row.state ?? "NY",
          zip: row.zip,
          phone: row.phone ?? null,
          hoursJson: row.hoursJson ?? null,
          languages: row.languages ?? null,
          eligibilityNotes: row.eligibilityNotes ?? null,
          lat: row.lat ?? null,
          lng: row.lng ?? null,
          geoPrecision: row.geoPrecision,
          contentHash: row.contentHash,
          datasetVersion: row.datasetVersion,
          status: "active",
          lastSeenAt: new Date(payload.generatedAt)
        })
        .onConflictDoUpdate({
          target: [
            resourceProviders.source,
            resourceProviders.sourceRef,
            resourceProviders.datasetVersion
          ],
          set: {
            name: sql`excluded.name`,
            type: sql`excluded.type`,
            addressText: sql`excluded.address_text`,
            city: sql`excluded.city`,
            state: sql`excluded.state`,
            zip: sql`excluded.zip`,
            phone: sql`excluded.phone`,
            hoursJson: sql`excluded.hours_json`,
            languages: sql`excluded.languages`,
            eligibilityNotes: sql`excluded.eligibility_notes`,
            lat: sql`excluded.lat`,
            lng: sql`excluded.lng`,
            geoPrecision: sql`excluded.geo_precision`,
            contentHash: sql`excluded.content_hash`,
            status: "active",
            lastSeenAt: sql`excluded.last_seen_at`,
            updatedAt: new Date()
          }
        });
    }
    process.stdout.write(
      `[seed] public-ingest :: ${summary.sourceId} upserted ${rowsForSource.length} rows\n`
    );
  }
}

type PilotProviderSeed = {
  providerId: string;
  sourceRef: string;
  name: string;
  type: "pantry" | "kitchen" | "market";
  addressText: string;
  city: string;
  zip: string;
  phone: string;
  hoursJson: Record<string, string>;
  languages: string[];
  eligibilityNotes: string;
  lat: number;
  lng: number;
  contentHash: string;
};

type PilotCommunitySeed = {
  communityId: string;
  communityName: string;
  centerZip: string;
  anchorUserId: string;
  anchorUserDisplayName: string;
  anchorUserLanguages: string[];
  seedUserId: string;
  seedUserDisplayName: string;
  seedUserLanguages: string[];
  anchorInviteId: string;
  anchorInviteCodeHash: string;
  anchorOrgName: string;
  anchorId: string;
  anchorContact: string;
  inviteAccessCodeId: string;
  inviteCode: string;
  qrAccessCodeId: string;
  qrToken: string;
  rulesetId: string;
  rulesetLanguagePreferences: string[];
  announcementId: string;
  announcementTitle: string;
  announcementBody: string;
  providers: PilotProviderSeed[];
  requestPostId: string;
  requestPostTitle: string;
  requestPostBody: string;
  requestPostLanguage: "en" | "es" | "zh";
  offerPostId: string;
  offerPostTitle: string;
  offerPostBody: string;
  offerPostLanguage: "en" | "es" | "zh";
};

async function seedPilotCommunity(db: Database, pilot: PilotCommunitySeed) {
  await db
    .insert(users)
    .values([
      {
        userId: pilot.anchorUserId,
        displayName: pilot.anchorUserDisplayName,
        preferredLanguages: pilot.anchorUserLanguages,
        homeZip: pilot.centerZip,
        level: "anchor",
        status: "active",
        emailHash: "demo_email_hash",
        emailHashSalt: "demo_email_salt"
      },
      {
        userId: pilot.seedUserId,
        displayName: pilot.seedUserDisplayName,
        preferredLanguages: pilot.seedUserLanguages,
        homeZip: pilot.centerZip,
        level: "verified",
        status: "active",
        phoneHash: "demo_phone_hash",
        phoneHashSalt: "demo_phone_salt"
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
      communityId: pilot.communityId,
      name: pilot.communityName,
      centerZip: pilot.centerZip,
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

  await db
    .insert(communityMembers)
    .values([
      { userId: pilot.anchorUserId, communityId: pilot.communityId },
      { userId: pilot.seedUserId, communityId: pilot.communityId }
    ])
    .onConflictDoNothing();

  await db
    .insert(communityAccessCodes)
    .values([
      {
        accessCodeId: pilot.inviteAccessCodeId,
        communityId: pilot.communityId,
        channel: "invite_code",
        code: pilot.inviteCode,
        status: "active"
      },
      {
        accessCodeId: pilot.qrAccessCodeId,
        communityId: pilot.communityId,
        channel: "qr_token",
        code: pilot.qrToken,
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
    });

  await db
    .insert(communityRulesets)
    .values({
      rulesetId: pilot.rulesetId,
      communityId: pilot.communityId,
      reviewCategories: ["transportation"],
      autoHideReportThreshold: 2,
      keywordBlocklist: ["cash only"],
      languagePreferences: pilot.rulesetLanguagePreferences,
      announcementPinStrategy: "manual",
      createdBy: pilot.anchorUserId
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
      rulesetId: pilot.rulesetId,
      updatedAt: new Date()
    })
    .where(eq(communities.communityId, pilot.communityId));

  await db
    .insert(anchorInvites)
    .values({
      anchorInviteId: pilot.anchorInviteId,
      communityId: pilot.communityId,
      codeHash: pilot.anchorInviteCodeHash,
      orgName: pilot.anchorOrgName,
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
      anchorId: pilot.anchorId,
      userId: pilot.anchorUserId,
      communityId: pilot.communityId,
      orgName: pilot.anchorOrgName,
      contact: pilot.anchorContact,
      status: "active",
      totpSecretCiphertext: seedValues.anchorTotpSecretCiphertext,
      recoveryCodesHashes: [...seedValues.anchorRecoveryCodeHashes],
      activatedAt: new Date("2026-04-04T11:30:00.000Z"),
      lastMfaAt: new Date("2026-04-04T11:45:00.000Z"),
      roleAssignments: {
        admins: [pilot.anchorUserId],
        mods: [pilot.anchorUserId]
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

  for (const provider of pilot.providers) {
    await db
      .update(resourceProviders)
      .set({
        status: "inactive",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(resourceProviders.source, "cfc_active"),
          eq(resourceProviders.sourceRef, provider.sourceRef),
          ne(resourceProviders.providerId, provider.providerId),
          sql`${resourceProviders.status} = 'active'`
        )
      );

    await db
      .insert(resourceProviders)
      .values({
        providerId: provider.providerId,
        source: "cfc_active",
        sourceRef: provider.sourceRef,
        name: provider.name,
        type: provider.type,
        addressText: provider.addressText,
        city: provider.city,
        state: "NY",
        zip: provider.zip,
        phone: provider.phone,
        hoursJson: provider.hoursJson,
        languages: provider.languages,
        eligibilityNotes: provider.eligibilityNotes,
        lat: provider.lat,
        lng: provider.lng,
        geoPrecision: "street",
        contentHash: provider.contentHash,
        datasetVersion: seedValues.datasetVersion,
        status: "active",
        lastSeenAt: new Date("2026-04-04T10:05:00.000Z"),
        lastVerifiedAt: new Date("2026-04-04T11:00:00.000Z")
      })
      .onConflictDoUpdate({
        target: [
          resourceProviders.source,
          resourceProviders.sourceRef,
          resourceProviders.datasetVersion
        ],
        set: {
          updatedAt: new Date(),
          status: "active"
        }
      });
  }

  await db
    .insert(announcements)
    .values({
      announcementId: pilot.announcementId,
      communityId: pilot.communityId,
      title: pilot.announcementTitle,
      body: pilot.announcementBody,
      status: "active",
      isPinned: true,
      createdBy: pilot.anchorUserId,
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
    .insert(posts)
    .values([
      {
        postId: pilot.requestPostId,
        postType: "request",
        category: "food",
        title: pilot.requestPostTitle,
        body: pilot.requestPostBody,
        language: pilot.requestPostLanguage,
        locationZip: pilot.centerZip,
        privacy: "community_only",
        expiresAt: new Date("2026-04-05T03:00:00.000Z"),
        createdBy: pilot.seedUserId,
        communityId: pilot.communityId,
        status: "active",
        riskLevel: "low",
        verificationState: "unverified",
        contactPref: {
          in_app_chat: true,
          call: false
        }
      },
      {
        postId: pilot.offerPostId,
        postType: "offer",
        category: "food",
        title: pilot.offerPostTitle,
        body: pilot.offerPostBody,
        language: pilot.offerPostLanguage,
        locationZip: pilot.centerZip,
        privacy: "community_only",
        expiresAt: new Date("2026-04-05T05:00:00.000Z"),
        createdBy: pilot.anchorUserId,
        communityId: pilot.communityId,
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
}

const queensPilot: PilotCommunitySeed = {
  communityId: seedIds.queensCommunityId,
  communityName: "Queens Corona Demo Community",
  centerZip: "11368",
  anchorUserId: seedIds.queensAnchorUserId,
  anchorUserDisplayName: "Queens Anchor Demo",
  anchorUserLanguages: ["en", "es", "zh"],
  seedUserId: seedIds.queensSeedUserId,
  seedUserDisplayName: "Queens Neighbor",
  seedUserLanguages: ["en", "es"],
  anchorInviteId: seedIds.queensAnchorInviteId,
  anchorInviteCodeHash: seedValues.queensAnchorInviteCodeHash,
  anchorOrgName: "Corona Community Mutual Aid",
  anchorId: seedIds.queensAnchorId,
  anchorContact: "queens-anchor@weavenyc.local",
  inviteAccessCodeId: seedIds.queensInviteAccessCodeId,
  inviteCode: seedValues.queensInviteCode,
  qrAccessCodeId: seedIds.queensQrAccessCodeId,
  qrToken: seedValues.queensQrToken,
  rulesetId: seedIds.queensRulesetId,
  rulesetLanguagePreferences: ["en", "es", "zh"],
  announcementId: seedIds.queensAnnouncementId,
  announcementTitle: seedValues.queensAnnouncementTitle,
  announcementBody: seedValues.queensAnnouncementBody,
  providers: [
    {
      providerId: seedIds.queensProviderIds[0],
      sourceRef: "cfc_active:corona-food-pantry-queens",
      name: "Corona Food Pantry",
      type: "pantry",
      addressText: "39-25 104th Street, Corona, NY",
      city: "Corona",
      zip: "11368",
      phone: "(718) 555-1001",
      hoursJson: {
        mon: "09:00-13:00",
        wed: "09:00-13:00",
        fri: "09:00-13:00"
      },
      languages: ["en", "es"],
      eligibilityNotes:
        "Open to Corona residents. Bring photo ID. Spanish-speaking volunteers on site.",
      lat: 40.7489,
      lng: -73.8627,
      contentHash: "demo_content_hash_q1"
    },
    {
      providerId: seedIds.queensProviderIds[1],
      sourceRef: "cfc_active:our-lady-sorrows-corona",
      name: "Our Lady of Sorrows Community Kitchen",
      type: "kitchen",
      addressText: "104-11 37th Avenue, Corona, NY",
      city: "Corona",
      zip: "11368",
      phone: "(718) 555-1002",
      hoursJson: {
        tue: "11:00-14:00",
        thu: "11:00-14:00"
      },
      languages: ["en", "es"],
      eligibilityNotes: "Hot meals served on site. No ID required.",
      lat: 40.7501,
      lng: -73.8611,
      contentHash: "demo_content_hash_q2"
    },
    {
      providerId: seedIds.queensProviderIds[2],
      sourceRef: "cfc_active:elmcor-community-market",
      name: "Elmcor Community Fresh Market",
      type: "market",
      addressText: "107-20 Northern Boulevard, Corona, NY",
      city: "Corona",
      zip: "11368",
      phone: "(718) 555-1003",
      hoursJson: {
        wed: "10:00-16:00",
        sat: "09:00-13:00"
      },
      languages: ["en", "es", "zh"],
      eligibilityNotes:
        "Fresh produce distribution. Open to all neighborhood residents.",
      lat: 40.7526,
      lng: -73.8682,
      contentHash: "demo_content_hash_q3"
    },
    {
      providerId: seedIds.queensProviderIds[3],
      sourceRef: "cfc_active:flushing-chinese-pantry",
      name: "Flushing Chinese Community Pantry",
      type: "pantry",
      addressText: "41-61 Kissena Boulevard, Flushing, NY",
      city: "Flushing",
      zip: "11355",
      phone: "(718) 555-1004",
      hoursJson: {
        mon: "10:00-15:00",
        thu: "10:00-15:00"
      },
      languages: ["en", "zh"],
      eligibilityNotes:
        "Near the 11368 border. Mandarin- and Cantonese-speaking volunteers.",
      lat: 40.7574,
      lng: -73.8317,
      contentHash: "demo_content_hash_q4"
    }
  ],
  requestPostId: seedIds.queensRequestPostId,
  requestPostTitle: "Need groceries for family of 4",
  requestPostBody:
    "Looking for rice, beans, and fresh produce this week. Can pick up within walking distance of 103rd St.",
  requestPostLanguage: "en",
  offerPostId: seedIds.queensOfferPostId,
  offerPostTitle: "Extra pantry shares available",
  offerPostBody:
    "I picked up more than we need at Corona Food Pantry this morning. Happy to share with a neighbor today.",
  offerPostLanguage: "en"
};

const bronxPilot: PilotCommunitySeed = {
  communityId: seedIds.bronxCommunityId,
  communityName: "Bronx Hunts Point Demo Community",
  centerZip: "10474",
  anchorUserId: seedIds.bronxAnchorUserId,
  anchorUserDisplayName: "Bronx Anchor Demo",
  anchorUserLanguages: ["en", "es"],
  seedUserId: seedIds.bronxSeedUserId,
  seedUserDisplayName: "Bronx Neighbor",
  seedUserLanguages: ["en", "es"],
  anchorInviteId: seedIds.bronxAnchorInviteId,
  anchorInviteCodeHash: seedValues.bronxAnchorInviteCodeHash,
  anchorOrgName: "Hunts Point Alliance for Children",
  anchorId: seedIds.bronxAnchorId,
  anchorContact: "bronx-anchor@weavenyc.local",
  inviteAccessCodeId: seedIds.bronxInviteAccessCodeId,
  inviteCode: seedValues.bronxInviteCode,
  qrAccessCodeId: seedIds.bronxQrAccessCodeId,
  qrToken: seedValues.bronxQrToken,
  rulesetId: seedIds.bronxRulesetId,
  rulesetLanguagePreferences: ["en", "es"],
  announcementId: seedIds.bronxAnnouncementId,
  announcementTitle: seedValues.bronxAnnouncementTitle,
  announcementBody: seedValues.bronxAnnouncementBody,
  providers: [
    {
      providerId: seedIds.bronxProviderIds[0],
      sourceRef: "cfc_active:st-barnabas-pantry-bronx",
      name: "St. Barnabas Pantry",
      type: "pantry",
      addressText: "409 East 138th Street, Bronx, NY",
      city: "Bronx",
      zip: "10454",
      phone: "(718) 555-2001",
      hoursJson: {
        tue: "09:00-12:00",
        thu: "09:00-12:00"
      },
      languages: ["en", "es"],
      eligibilityNotes: "Bronx residents welcome. Bring ID and proof of address.",
      lat: 40.8085,
      lng: -73.9228,
      contentHash: "demo_content_hash_b1"
    },
    {
      providerId: seedIds.bronxProviderIds[1],
      sourceRef: "cfc_active:hunts-point-alliance-kitchen",
      name: "Hunts Point Alliance Community Kitchen",
      type: "kitchen",
      addressText: "630 Jackson Avenue, Bronx, NY",
      city: "Bronx",
      zip: "10474",
      phone: "(718) 555-2002",
      hoursJson: {
        mon: "12:00-14:00",
        wed: "12:00-14:00",
        fri: "12:00-14:00"
      },
      languages: ["en", "es"],
      eligibilityNotes:
        "Hot meals on site. No ID required. Walk-ins welcome.",
      lat: 40.8116,
      lng: -73.8909,
      contentHash: "demo_content_hash_b2"
    },
    {
      providerId: seedIds.bronxProviderIds[2],
      sourceRef: "cfc_active:longwood-fresh-market",
      name: "Longwood Fresh Market",
      type: "market",
      addressText: "930 Hunts Point Avenue, Bronx, NY",
      city: "Bronx",
      zip: "10474",
      phone: "(718) 555-2003",
      hoursJson: {
        wed: "10:00-15:00",
        sat: "09:00-13:00"
      },
      languages: ["en", "es"],
      eligibilityNotes: "Low-cost fresh produce for Bronx residents.",
      lat: 40.8142,
      lng: -73.8861,
      contentHash: "demo_content_hash_b3"
    }
  ],
  requestPostId: seedIds.bronxRequestPostId,
  requestPostTitle: "Need baby formula this week",
  requestPostBody:
    "Looking for infant formula and diapers size 3 for the next few days. Can meet near Hunts Point Ave.",
  requestPostLanguage: "en",
  offerPostId: seedIds.bronxOfferPostId,
  offerPostTitle: "Can share hot meals this Friday",
  offerPostBody:
    "Preparing extra meals at the community kitchen on Friday. Message me for a portion.",
  offerPostLanguage: "en"
};
