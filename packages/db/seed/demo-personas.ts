/**
 * demo-personas.ts — B5/B6 demo readiness seed.
 *
 * Seeds 5 named personas into the Queens (11368 — Corona) pilot community
 * plus one Farmingdale (11735) newcomer persona, with supporting posts,
 * reports that cross the autoHideReportThreshold=2, and an in-progress
 * conversation for the scene-6 live-block demo.
 *
 * SAFETY NOTES
 * ────────────
 *  - Phone numbers use the NANP "reserved-for-fiction" 555-0100..0199 range
 *    (here extended with +15550001201..0001205). These prefixes are
 *    guaranteed unroutable by all US carriers; Twilio will refuse to dial
 *    them. The raw numbers NEVER leave this seed file — we only store the
 *    SHA-256-style stub hashes (`demo_phone_hash_01` etc.) that follow the
 *    `packages/db/seed/index.ts:45-57` pattern.
 *  - Email addresses use the `.test` TLD (RFC 2606 reserved) with
 *    `@weavenyc.test` subdomain. Mail to this domain cannot be delivered
 *    outside a test harness.
 *
 * IDEMPOTENCY
 * ───────────
 *  All inserts use onConflictDoUpdate so re-running the seed (as part of a
 *  preflight check or a fresh local demo spin-up) updates the existing rows
 *  instead of raising a unique-constraint violation.
 *
 * GATING
 * ──────
 *  Invoked from `packages/db/seed/index.ts` only when
 *  `SEED_DEMO_PERSONAS=1` is set in the environment. Normal dev seed
 *  (no env flag) skips these rows to keep the default dev dataset lean.
 *
 * DEMO CODE STUBBING
 * ──────────────────
 *  The PWA's sandbox mode auto-fills the OTP input with `246810`. The
 *  gateway's challenge store is NOT pre-populated from this seed — doing
 *  so would require cross-service state that lives in Redis/refresh-token
 *  store, not Postgres. For the demo the visual auto-fill is enough; the
 *  sandbox banner signals to reviewers that real OTP verification is
 *  bypassed. If full OTP stubbing is needed later, the hook point is
 *  `services/api-gateway/src/lib/identity-challenge-store.ts` — pre-insert
 *  a challenge with kind="otp", userId=<persona>, codeHash=hash("246810").
 */
import { sql } from "drizzle-orm";

import type { Database } from "../src/client";
import {
  contactRequests,
  conversations,
  communityMembers,
  posts,
  reports,
  users
} from "../src/schema";
import { seedIds } from "./fixtures";

/**
 * Fixed UUIDs for the five demo personas and their supporting rows.
 * Kept distinct from the existing `seedIds` block so a normal dev seed
 * (without SEED_DEMO_PERSONAS=1) never references them.
 */
export const demoPersonaIds = {
  // P1 — Marisol Quintero (Queens, verified)
  marisolUserId: "d1010101-0101-4101-8101-010101010101",
  // P2 — Dwayne Okafor (Queens, verified)
  dwayneUserId: "d2020202-0202-4202-8202-020202020202",
  // P3 — Priya Raman (Queens, anchor)
  priyaUserId: "d3030303-0303-4303-8303-030303030303",
  // P4 — Jorge Vela (Farmingdale, newly-verified)
  jorgeUserId: "d4040404-0404-4404-8404-040404040404",
  // P5 — Skyler Nash (Queens, would-be abuser)
  skylerUserId: "d5050505-0505-4505-8505-050505050505",

  // Posts
  marisolOfferPostId: "d1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
  dwayneRequestPostId: "d2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2",
  jorgeRequestPostId: "d4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4",
  skylerOfferPostId: "d5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5",

  // Two reports against Skyler's post — crosses autoHideReportThreshold=2.
  skylerReportAId: "d5b10101-b101-4101-8101-b10101010101",
  skylerReportBId: "d5b20202-b202-4202-8202-b20202020202",

  // Scene-6 live block: P5 ↔ P2 in-progress conversation.
  skylerDwayneContactRequestId: "d5c10101-c101-4101-8101-c10101010101",
  skylerDwayneConversationId: "d5c20202-c202-4202-8202-c20202020202"
} as const;

type DemoPersona = {
  userId: string;
  displayName: string;
  homeZip: string;
  preferredLanguages: string[];
  level: "verified" | "anchor";
  phoneHash: string;
  emailHash: string;
  communityId: string;
};

/**
 * Canonical persona roster. Raw phone/email never leave this file — only
 * the stub hash pair is persisted.
 */
const DEMO_PERSONAS: DemoPersona[] = [
  {
    userId: demoPersonaIds.marisolUserId,
    displayName: "Marisol Quintero",
    homeZip: "11368",
    preferredLanguages: ["es", "en"],
    level: "verified",
    phoneHash: "demo_phone_hash_01",
    emailHash: "demo_email_hash_01",
    communityId: seedIds.queensCommunityId
  },
  {
    userId: demoPersonaIds.dwayneUserId,
    displayName: "Dwayne Okafor",
    homeZip: "11368",
    preferredLanguages: ["en"],
    level: "verified",
    phoneHash: "demo_phone_hash_02",
    emailHash: "demo_email_hash_02",
    communityId: seedIds.queensCommunityId
  },
  {
    userId: demoPersonaIds.priyaUserId,
    displayName: "Priya Raman",
    homeZip: "11368",
    preferredLanguages: ["en"],
    level: "anchor",
    phoneHash: "demo_phone_hash_03",
    emailHash: "demo_email_hash_03",
    communityId: seedIds.queensCommunityId
  },
  {
    userId: demoPersonaIds.jorgeUserId,
    displayName: "Jorge Vela",
    homeZip: "11735",
    preferredLanguages: ["es", "en"],
    level: "verified",
    phoneHash: "demo_phone_hash_04",
    emailHash: "demo_email_hash_04",
    communityId: seedIds.communityId
  },
  {
    userId: demoPersonaIds.skylerUserId,
    displayName: "Skyler Nash",
    homeZip: "11368",
    preferredLanguages: ["en"],
    level: "verified",
    phoneHash: "demo_phone_hash_05",
    emailHash: "demo_email_hash_05",
    communityId: seedIds.queensCommunityId
  }
];

/**
 * seedDemoPersonas — idempotent upsert of the five demo personas plus
 * their content. Called from `seedDatabase` when SEED_DEMO_PERSONAS=1.
 *
 * The seed expects the Queens + Farmingdale pilot communities (and their
 * anchors/rulesets) to already exist — they are seeded earlier in
 * `seedDatabase`. We only add users, memberships, posts, reports, and the
 * Skyler↔Dwayne conversation.
 */
export async function seedDemoPersonas(db: Database): Promise<void> {
  // ────── 1. Persona users ──────────────────────────────────────────────
  await db
    .insert(users)
    .values(
      DEMO_PERSONAS.map((persona) => ({
        userId: persona.userId,
        displayName: persona.displayName,
        preferredLanguages: persona.preferredLanguages,
        homeZip: persona.homeZip,
        level: persona.level,
        status: "active" as const,
        phoneHash: persona.phoneHash,
        phoneHashSalt: "demo_phone_salt",
        emailHash: persona.emailHash,
        emailHashSalt: "demo_email_salt"
      }))
    )
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

  // ────── 2. Community memberships ──────────────────────────────────────
  await db
    .insert(communityMembers)
    .values(
      DEMO_PERSONAS.map((persona) => ({
        userId: persona.userId,
        communityId: persona.communityId
      }))
    )
    .onConflictDoNothing();

  // ────── 3. Posts ─────────────────────────────────────────────────────
  // Base timestamps: the preflight script rewrites demo-fresh-timestamps
  // for the PWA; these server-side Dates just seed a plausible "recent"
  // window so a fresh db shows non-expired posts.
  const now = new Date();
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);

  await db
    .insert(posts)
    .values([
      {
        postId: demoPersonaIds.marisolOfferPostId,
        postType: "offer",
        category: "food",
        title: "Extra rice & beans from Saturday's cookout",
        body:
          "Extra rice & beans from Saturday's cookout — two sealed containers, pickup at 103rd & Roosevelt before Thursday.",
        language: "en",
        locationZip: "11368",
        privacy: "community_only",
        expiresAt: hoursFromNow(72),
        createdBy: demoPersonaIds.marisolUserId,
        communityId: seedIds.queensCommunityId,
        status: "active",
        riskLevel: "low",
        verificationState: "verified_by_anchor",
        contactPref: { in_app_chat: true, call: false }
      },
      {
        postId: demoPersonaIds.dwayneRequestPostId,
        postType: "request",
        category: "goods",
        title: "Looking for a stroller base (infant, any brand)",
        body:
          "Looking for a stroller base (infant, any brand) — new baby arriving May. Can pick up anywhere in Corona.",
        language: "en",
        locationZip: "11368",
        privacy: "community_only",
        expiresAt: hoursFromNow(168),
        createdBy: demoPersonaIds.dwayneUserId,
        communityId: seedIds.queensCommunityId,
        status: "active",
        riskLevel: "low",
        verificationState: "verified_by_anchor",
        contactPref: { in_app_chat: true, call: false }
      },
      {
        postId: demoPersonaIds.jorgeRequestPostId,
        postType: "request",
        category: "transportation",
        title: "Ride to Farmingdale HRA office Tuesday AM",
        body:
          "Need a ride to Farmingdale HRA office Tuesday AM — happy to split gas.",
        language: "en",
        locationZip: "11735",
        privacy: "community_only",
        expiresAt: hoursFromNow(96),
        createdBy: demoPersonaIds.jorgeUserId,
        communityId: seedIds.communityId,
        status: "active",
        riskLevel: "medium",
        verificationState: "verified_by_anchor",
        contactPref: { in_app_chat: true, call: true }
      },
      {
        postId: demoPersonaIds.skylerOfferPostId,
        postType: "offer",
        category: "goods",
        title: "Brand-new iPhones, DM for price",
        body: "Selling brand-new iPhones, DM for price.",
        language: "en",
        locationZip: "11368",
        privacy: "community_only",
        expiresAt: hoursFromNow(48),
        createdBy: demoPersonaIds.skylerUserId,
        communityId: seedIds.queensCommunityId,
        status: "active",
        riskLevel: "high",
        verificationState: "unverified",
        contactPref: { in_app_chat: true, call: false }
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

  // ────── 4. Reports against Skyler's post (crosses threshold=2) ────────
  await db
    .insert(reports)
    .values([
      {
        reportId: demoPersonaIds.skylerReportAId,
        communityId: seedIds.queensCommunityId,
        targetType: "post",
        targetId: demoPersonaIds.skylerOfferPostId,
        reason: "scam",
        detailText:
          "Looks like the same iPhone-resale scam we've seen on other neighborhood groups.",
        conversationId: null,
        reporterUserId: demoPersonaIds.marisolUserId,
        status: "new",
        resolution: null,
        resolvedAt: null
      },
      {
        reportId: demoPersonaIds.skylerReportBId,
        communityId: seedIds.queensCommunityId,
        targetType: "post",
        targetId: demoPersonaIds.skylerOfferPostId,
        reason: "scam",
        detailText: "Possible scam — no price listed, no pickup location.",
        conversationId: null,
        reporterUserId: demoPersonaIds.dwayneUserId,
        status: "new",
        resolution: null,
        resolvedAt: null
      }
    ])
    .onConflictDoUpdate({
      target: reports.reportId,
      set: {
        communityId: sql`excluded.community_id`,
        targetType: sql`excluded.target_type`,
        targetId: sql`excluded.target_id`,
        reason: sql`excluded.reason`,
        detailText: sql`excluded.detail_text`,
        reporterUserId: sql`excluded.reporter_user_id`,
        status: sql`excluded.status`,
        resolution: null,
        resolvedAt: null
      }
    });

  // ────── 5. Scene-6 live-block conversation: P5 (Skyler) ↔ P2 (Dwayne) ──
  // contact_request must exist first (conversations.contact_request_id is
  // a unique+NOT NULL FK).
  await db
    .insert(contactRequests)
    .values({
      contactRequestId: demoPersonaIds.skylerDwayneContactRequestId,
      fromPostId: demoPersonaIds.skylerOfferPostId,
      toPostId: demoPersonaIds.dwayneRequestPostId,
      requesterUserId: demoPersonaIds.skylerUserId,
      recipientUserId: demoPersonaIds.dwayneUserId,
      status: "accepted",
      respondedAt: new Date(now.getTime() - 30 * 60_000),
      expiresAt: hoursFromNow(48)
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
      conversationId: demoPersonaIds.skylerDwayneConversationId,
      participants: [demoPersonaIds.skylerUserId, demoPersonaIds.dwayneUserId],
      relatedPostIds: [
        demoPersonaIds.skylerOfferPostId,
        demoPersonaIds.dwayneRequestPostId
      ],
      contactRequestId: demoPersonaIds.skylerDwayneContactRequestId,
      lastActivityAt: new Date(now.getTime() - 10 * 60_000)
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
}
