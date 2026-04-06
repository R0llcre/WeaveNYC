import { Pool } from "pg";

import { getDbEnv } from "../src/env";

const ids = {
  community: "2f026707-a9d9-4fc8-aab2-7fc1b856f4d1",
  anonymousUser: "7c15a1e5-7bb3-498f-a68f-cf3f4a2b9d11",
  verifiedUser: "16f59f73-fb26-46fb-8d34-5cd3f9e58f72",
  anchorUser: "cbc6629a-cbe3-460f-a560-5c60a96e2f31",
  anchorOrg: "4f859c0c-0c7f-497b-8780-a0be6dfec856",
  datasetVersionCfc: "4f65db57-e341-418d-b8b3-5c1bf0e4e761",
  datasetVersionIsland: "5fb97d9f-6d0b-44a7-b2eb-2ab8d93c60e1",
  providerCfcKilian: "ba4d4aa2-d9c0-4638-b0c4-f40690e4c19d",
  providerIslandHope: "1ba3fdb0-9b96-4664-8a5c-0c053dd66811",
  providerIslandBethpage: "ae06c84a-8f38-489b-9a2e-9478392a43a8",
  providerIslandPowered: "70359750-e6f8-49d3-a51b-cd240255ef16",
  changeLogCfc: "aab75a56-5044-4d0b-9c24-c2ae7b9dd5d6",
  changeLogIsland: "84ac6478-d6d3-4b65-8d7f-a17d975f6ed3",
  verificationLog: "df85079a-fc7b-4af4-b4ff-fd5d3f56ec2a",
  requestPost: "cbcff840-c4d3-46da-ae82-d83c691d4b2c",
  offerPost: "9899b628-f624-4fd4-92ce-266cb14f0d84",
  suggestion: "1c6f9a4a-14f1-47e4-a447-0a3199989f4e",
  contactRequest: "422db5a0-74e4-4759-900c-7e34b2d719ef",
  conversation: "c1daa27b-6f78-4581-886d-0a6b98c4c83f",
  message: "99741caa-bd99-412f-a3e4-2bb0ec1fcc8b",
  report: "fe437d74-3ab1-469f-a35d-f2a5223fc6b6",
  moderationAction: "dbd9c93d-981b-45f7-8501-8a1d3f376dca"
} as const;

export async function runSeed(): Promise<void> {
  const pool = new Pool({
    connectionString: getDbEnv().databaseUrl
  });

  try {
    await pool.query("begin");

    await pool.query(
      `
        insert into communities (
          community_id, name, center_zip, join_policy, created_at, updated_at
        )
        values ($1, $2, $3, $4, now(), now())
        on conflict (community_id) do update
          set name = excluded.name,
              center_zip = excluded.center_zip,
              join_policy = excluded.join_policy,
              updated_at = now();
      `,
      [ids.community, "Farmingdale Mutual Aid", "11735", "invite_only"]
    );

    await pool.query(
      `
        insert into users (
          user_id, display_name, preferred_languages, home_zip, level, status, created_at, updated_at
        )
        values
          ($1, $2, $3, $4, $5, 'active', now(), now()),
          ($6, $7, $8, $9, $10, 'active', now(), now()),
          ($11, $12, $13, $14, $15, 'active', now(), now())
        on conflict (user_id) do update
          set display_name = excluded.display_name,
              preferred_languages = excluded.preferred_languages,
              home_zip = excluded.home_zip,
              level = excluded.level,
              updated_at = now();
      `,
      [
        ids.anonymousUser,
        "Guest Session",
        ["en"],
        "11735",
        "anonymous",
        ids.verifiedUser,
        "Verified Neighbor",
        ["en", "es"],
        "11735",
        "verified",
        ids.anchorUser,
        "Anchor Admin",
        ["en", "zh"],
        "11735",
        "anchor"
      ]
    );

    await pool.query(
      `
        insert into community_members (user_id, community_id, joined_at)
        values
          ($1, $4, now()),
          ($2, $4, now()),
          ($3, $4, now())
        on conflict (user_id, community_id) do update
          set joined_at = excluded.joined_at;
      `,
      [ids.anonymousUser, ids.verifiedUser, ids.anchorUser, ids.community]
    );

    await pool.query(
      `
        insert into anchors (
          anchor_id, community_id, org_name, contact, role_assignments, created_at
        )
        values ($1, $2, $3, $4, $5::jsonb, now())
        on conflict (anchor_id) do update
          set org_name = excluded.org_name,
              contact = excluded.contact,
              role_assignments = excluded.role_assignments;
      `,
      [
        ids.anchorOrg,
        ids.community,
        "St. Kilian Parish Social Ministry",
        "anchor@weavenyc.local",
        JSON.stringify({ admins: [ids.anchorUser], mods: [ids.anchorUser] })
      ]
    );

    const datasetRows = [
      {
        datasetVersionId: ids.datasetVersionCfc,
        source: "cfc_active",
        datasetVersion: "cfc_active_2026-02-26",
        sourceLabel: "NYC HRA Community Food Connection",
        sourceUrl: "https://www1.nyc.gov/assets/hra/downloads/pdf/services/efap/CFC_ACTIVE.pdf",
        recordCount: 1,
        activeRecordCount: 1,
        checksum: "cfc_seed_20260405",
        importStartedAt: new Date("2026-04-05T10:00:00Z"),
        importCompletedAt: new Date("2026-04-05T10:05:00Z")
      },
      {
        datasetVersionId: ids.datasetVersionIsland,
        source: "island_harvest",
        datasetVersion: "island_harvest_2026-04-05T101500Z",
        sourceLabel: "Island Harvest Pantry Finder",
        sourceUrl: "https://storerocket.io/api/user/n0pjnLgp6V/locations",
        recordCount: 3,
        activeRecordCount: 3,
        checksum: "island_seed_20260405",
        importStartedAt: new Date("2026-04-05T10:15:00Z"),
        importCompletedAt: new Date("2026-04-05T10:20:00Z")
      }
    ];

    for (const datasetRow of datasetRows) {
      await pool.query(
        `
          insert into dataset_versions (
            dataset_version_id, source, dataset_version, source_label, source_url,
            record_count, active_record_count, status, checksum, import_started_at,
            import_completed_at, created_at, updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, now(), now())
          on conflict (source, dataset_version) do update
            set source_label = excluded.source_label,
                source_url = excluded.source_url,
                record_count = excluded.record_count,
                active_record_count = excluded.active_record_count,
                status = excluded.status,
                checksum = excluded.checksum,
                import_started_at = excluded.import_started_at,
                import_completed_at = excluded.import_completed_at,
                updated_at = now();
        `,
        [
          datasetRow.datasetVersionId,
          datasetRow.source,
          datasetRow.datasetVersion,
          datasetRow.sourceLabel,
          datasetRow.sourceUrl,
          datasetRow.recordCount,
          datasetRow.activeRecordCount,
          datasetRow.checksum,
          datasetRow.importStartedAt,
          datasetRow.importCompletedAt
        ]
      );
    }

    const resourceRows = [
      {
        providerId: ids.providerCfcKilian,
        source: "cfc_active",
        sourceRef: "cfc_active:st-kilian-farmingdale",
        name: "St. Kilian Parish Social Ministry",
        type: "pantry",
        addressText: "140 Elizabeth Street, Farmingdale, NY",
        city: "Farmingdale",
        state: "NY",
        zip: "11735",
        phone: "516-756-9656",
        hoursJson: { mon: "09:30AM-12:30PM", tue: "09:30AM-12:30PM" },
        languages: ["en", "es"],
        eligibilityNotes: "Official CFC listing. Call ahead for current requirements.",
        lat: 40.7336226,
        lng: -73.4429049,
        geoPrecision: "street",
        contentHash: "cfc_seed_st_kilian_hash",
        datasetVersion: "cfc_active_2026-02-26"
      },
      {
        providerId: ids.providerIslandHope,
        source: "island_harvest",
        sourceRef: "island_harvest:9109020",
        name: "Hope for the Future",
        type: "pantry",
        addressText: "131 Verdi Street, Farmingdale, NY",
        city: "Farmingdale",
        state: "NY",
        zip: "11735",
        phone: "(631)752-5771",
        hoursJson: { thu: "04:00PM-06:00PM" },
        languages: ["en"],
        eligibilityNotes: "Imported from Island Harvest pantry finder.",
        lat: 40.7132143,
        lng: -73.4172384,
        geoPrecision: "street",
        contentHash: "island_seed_hope_hash",
        datasetVersion: "island_harvest_2026-04-05T101500Z"
      },
      {
        providerId: ids.providerIslandBethpage,
        source: "island_harvest",
        sourceRef: "island_harvest:9109135",
        name: "St. Martin of Tours - Bethpage",
        type: "pantry",
        addressText: "208 Broadway, Bethpage, NY",
        city: "Bethpage",
        state: "NY",
        zip: "11714",
        phone: "(516)931-7332",
        hoursJson: { mon: "09:00AM-12:00PM", thu: "09:00AM-12:00PM" },
        languages: ["en"],
        eligibilityNotes: "Imported from Island Harvest pantry finder.",
        lat: 40.7383388,
        lng: -73.4792242,
        geoPrecision: "street",
        contentHash: "island_seed_bethpage_hash",
        datasetVersion: "island_harvest_2026-04-05T101500Z"
      },
      {
        providerId: ids.providerIslandPowered,
        source: "island_harvest",
        sourceRef: "island_harvest:9109073",
        name: "Powered by Christ",
        type: "pantry",
        addressText: "138 N Linden Street, Massapequa, NY",
        city: "Massapequa",
        state: "NY",
        zip: "11758",
        phone: "(516)826-6044",
        hoursJson: { fri: "10:00AM-11:00AM" },
        languages: ["en"],
        eligibilityNotes: "Imported from Island Harvest pantry finder.",
        lat: 40.7042669,
        lng: -73.4565542,
        geoPrecision: "street",
        contentHash: "island_seed_powered_hash",
        datasetVersion: "island_harvest_2026-04-05T101500Z"
      }
    ];

    for (const resourceRow of resourceRows) {
      await pool.query(
        `
          insert into resource_providers (
            provider_id, source, source_ref, name, type, address_text, city, state, zip,
            phone, hours_json, languages, eligibility_notes, lat, lng, geo_precision,
            content_hash, dataset_version, status, last_seen_at, last_verified_at,
            created_at, updated_at
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11::jsonb, $12, $13, $14, $15, $16,
            $17, $18, 'active', now(), now(), now(), now()
          )
          on conflict (provider_id) do update
            set name = excluded.name,
                phone = excluded.phone,
                hours_json = excluded.hours_json,
                languages = excluded.languages,
                eligibility_notes = excluded.eligibility_notes,
                dataset_version = excluded.dataset_version,
                status = 'active',
                updated_at = now();
        `,
        [
          resourceRow.providerId,
          resourceRow.source,
          resourceRow.sourceRef,
          resourceRow.name,
          resourceRow.type,
          resourceRow.addressText,
          resourceRow.city,
          resourceRow.state,
          resourceRow.zip,
          resourceRow.phone,
          JSON.stringify(resourceRow.hoursJson),
          resourceRow.languages,
          resourceRow.eligibilityNotes,
          resourceRow.lat,
          resourceRow.lng,
          resourceRow.geoPrecision,
          resourceRow.contentHash,
          resourceRow.datasetVersion
        ]
      );
    }

    const changeLogs = [
      {
        changeLogId: ids.changeLogCfc,
        source: "cfc_active",
        sourceRef: "cfc_active:st-kilian-farmingdale",
        datasetVersion: "cfc_active_2026-02-26",
        changeType: "added",
        changedFields: ["name", "hours_json"],
        contentHashAfter: "cfc_seed_st_kilian_hash"
      },
      {
        changeLogId: ids.changeLogIsland,
        source: "island_harvest",
        sourceRef: "island_harvest:9109020",
        datasetVersion: "island_harvest_2026-04-05T101500Z",
        changeType: "added",
        changedFields: ["name", "address_text", "hours_json"],
        contentHashAfter: "island_seed_hope_hash"
      }
    ];

    for (const changeLog of changeLogs) {
      await pool.query(
        `
          insert into resource_change_logs (
            change_log_id, source, source_ref, dataset_version, change_type,
            changed_fields, content_hash_before, content_hash_after, created_at
          )
          values ($1, $2, $3, $4, $5, $6, null, $7, now())
          on conflict (change_log_id) do update
            set change_type = excluded.change_type,
                changed_fields = excluded.changed_fields,
                content_hash_after = excluded.content_hash_after;
        `,
        [
          changeLog.changeLogId,
          changeLog.source,
          changeLog.sourceRef,
          changeLog.datasetVersion,
          changeLog.changeType,
          changeLog.changedFields,
          changeLog.contentHashAfter
        ]
      );
    }

    await pool.query(
      `
        insert into verification_logs (
          verification_log_id, provider_id, verifier, method, result, notes, created_at
        )
        values ($1, $2, $3, $4, $5, $6, now())
        on conflict (verification_log_id) do update
          set verifier = excluded.verifier,
              method = excluded.method,
              result = excluded.result,
              notes = excluded.notes;
      `,
      [
        ids.verificationLog,
        ids.providerCfcKilian,
        "anchor@weavenyc.local",
        "manual_review",
        "confirmed",
        "Verified against community partner spreadsheet."
      ]
    );

    await pool.query(
      `
        insert into posts (
          post_id, post_type, category, title, body, language, location_zip, privacy,
          expires_at, created_by, community_id, status, risk_level, verification_state,
          contact_pref, created_at, updated_at
        )
        values
          ($1, 'request', 'food', $2, $3, 'en', '11735', 'community_only', $4, $5, $6, 'active', 'low', 'unverified', $7::jsonb, now(), now()),
          ($8, 'offer', 'food', $9, $10, 'es', '11735', 'community_only', $11, $12, $6, 'active', 'low', 'verified_by_anchor', $7::jsonb, now(), now())
        on conflict (post_id) do update
          set title = excluded.title,
              body = excluded.body,
              status = excluded.status,
              updated_at = now();
      `,
      [
        ids.requestPost,
        "Need dinner for 2",
        "We are short on food tonight. Anything helps.",
        new Date("2026-04-05T03:00:00Z"),
        ids.anonymousUser,
        ids.community,
        JSON.stringify({ in_app_chat: true, call: false }),
        ids.offerPost,
        "Can share pantry staples",
        "I can share canned goods and rice after 6pm.",
        new Date("2026-04-05T06:00:00Z"),
        ids.verifiedUser
      ]
    );

    await pool.query(
      `
        insert into match_suggestions (
          suggestion_id, request_post_id, candidate_type, candidate_id, score, reasons, created_at
        )
        values ($1, $2, 'official_resource', $3, $4, $5, now())
        on conflict (suggestion_id) do update
          set score = excluded.score,
              reasons = excluded.reasons;
      `,
      [ids.suggestion, ids.requestPost, ids.providerCfcKilian, 0.81, ["same_zip", "open_today"]]
    );

    await pool.query(
      `
        insert into contact_requests (
          contact_request_id, from_post_id, to_post_id, requester_user_id,
          recipient_user_id, status, created_at, responded_at, expires_at
        )
        values ($1, $2, $3, $4, $5, 'accepted', now(), now(), $6)
        on conflict (contact_request_id) do update
          set status = excluded.status,
              responded_at = excluded.responded_at,
              expires_at = excluded.expires_at;
      `,
      [
        ids.contactRequest,
        ids.requestPost,
        ids.offerPost,
        ids.anonymousUser,
        ids.verifiedUser,
        new Date("2026-04-06T00:00:00Z")
      ]
    );

    await pool.query(
      `
        insert into conversations (
          conversation_id, participants, related_post_ids, contact_request_id,
          created_at, last_activity_at
        )
        values ($1, $2, $3, $4, now(), now())
        on conflict (conversation_id) do update
          set participants = excluded.participants,
              related_post_ids = excluded.related_post_ids,
              last_activity_at = now();
      `,
      [
        ids.conversation,
        [ids.anonymousUser, ids.verifiedUser],
        [ids.requestPost, ids.offerPost],
        ids.contactRequest
      ]
    );

    await pool.query(
      `
        insert into messages (
          message_id, conversation_id, sender_user_id, body, safety_flags, sent_at
        )
        values ($1, $2, $3, $4, $5, now())
        on conflict (message_id) do update
          set body = excluded.body,
              safety_flags = excluded.safety_flags;
      `,
      [
        ids.message,
        ids.conversation,
        ids.verifiedUser,
        "I can leave the food with the front desk after 6pm.",
        ["manual_fixture"]
      ]
    );

    await pool.query(
      `
        insert into reports (
          report_id, target_type, target_id, reason, detail_text, reporter_user_id,
          status, resolution, created_at, resolved_at
        )
        values ($1, 'post', $2, 'other', $3, $4, 'resolved', 'none', now(), now())
        on conflict (report_id) do update
          set detail_text = excluded.detail_text,
              status = excluded.status,
              resolution = excluded.resolution,
              resolved_at = excluded.resolved_at;
      `,
      [
        ids.report,
        ids.requestPost,
        "Fixture report used to exercise moderation schema.",
        ids.anchorUser
      ]
    );

    await pool.query(
      `
        insert into moderation_actions (
          action_id, report_id, anchor_user_id, community_id,
          action_type, target_type, target_id, reason, created_at
        )
        values ($1, $2, $3, $4, 'warn', 'post', $5, $6, now())
        on conflict (action_id) do update
          set reason = excluded.reason;
      `,
      [
        ids.moderationAction,
        ids.report,
        ids.anchorUser,
        ids.community,
        ids.requestPost,
        "Fixture moderation record."
      ]
    );

    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void runSeed().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
