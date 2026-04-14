import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { encodeDagNode } from "@weavenyc/p2p";

import { PostsRepository } from "../src/repository.js";

function buildPostDag(row: {
  post_id: string;
  community_id: string;
  post_type: string;
  category: string;
  title: string;
  body: string;
  language: string;
  location_zip: string;
  privacy: string;
  status: string;
  risk_level: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  contact_pref: unknown;
  p2p_version: number;
}) {
  return {
    kind: "post",
    post_id: row.post_id,
    community_id: row.community_id,
    post_type: row.post_type,
    category: row.category,
    title: row.title,
    body: row.body,
    language: row.language,
    location_zip: row.location_zip,
    privacy: row.privacy,
    status: row.status,
    risk_level: row.risk_level,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    contact_pref: row.contact_pref,
    p2p_version: row.p2p_version,
  };
}

function buildAnnouncementDag(row: {
  announcement_id: string;
  community_id: string;
  title: string;
  body: string;
  status: string;
  is_pinned: boolean;
  created_by: string;
  published_at: string;
  updated_at: string;
  p2p_version: number;
}) {
  return {
    kind: "announcement",
    announcement_id: row.announcement_id,
    community_id: row.community_id,
    title: row.title,
    body: row.body,
    status: row.status,
    is_pinned: row.is_pinned,
    created_by: row.created_by,
    published_at: row.published_at,
    updated_at: row.updated_at,
    p2p_version: row.p2p_version,
  };
}

describe("PostsRepository community rules sanitization", () => {
  it("filters invalid DB rule values before returning API payloads", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            ruleset_id: "11111111-1111-4111-8111-111111111111",
            community_id: "22222222-2222-4222-8222-222222222222",
            review_categories: ["food", "invalid-category", "food", "transportation"],
            auto_hide_report_threshold: 99,
            keyword_blocklist: [" cash only ", "", "x".repeat(121), "cash only"],
            language_preferences: ["en", "invalid-lang", "zh", "en"],
            announcement_pin_strategy: "not-a-real-strategy",
            updated_at: "2026-04-12T12:00:00.000Z",
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Pool;

    const repository = new PostsRepository(pool);
    const rules = await repository.getCommunityRules("22222222-2222-4222-8222-222222222222");

    expect(rules).toEqual({
      community_id: "22222222-2222-4222-8222-222222222222",
      review_categories: ["food", "transportation"],
      auto_hide_report_threshold: 20,
      keyword_blocklist: ["cash only"],
      language_preferences: ["en", "zh"],
      announcement_pin_strategy: "latest",
      updated_at: "2026-04-12T12:00:00.000Z",
    });
  });

  it("stamps posts with persisted p2p_version and CID across create/update/read paths", async () => {
    const insertedRow = {
      post_id: "11111111-1111-4111-8111-111111111111",
      community_id: "22222222-2222-4222-8222-222222222222",
      post_type: "request",
      category: "food",
      title: "Need dinner",
      body: "Need dinner tonight",
      language: "en",
      location_zip: "11735",
      privacy: "community_only",
      status: "active",
      risk_level: "low",
      expires_at: "2026-04-20T00:00:00.000Z",
      created_at: "2026-04-13T10:00:00.000Z",
      updated_at: "2026-04-13T10:00:00.000Z",
      created_by: "33333333-3333-4333-8333-333333333333",
      contact_pref: { method: "phone" },
      p2p_version: 1,
      ipfs_cid: null,
    };
    const insertedCid = (await encodeDagNode(buildPostDag(insertedRow))).cid;
    const updatedRow = {
      ...insertedRow,
      title: "Need groceries",
      body: "Need groceries tomorrow",
      updated_at: "2026-04-13T12:00:00.000Z",
      p2p_version: 2,
    };
    const updatedCid = (await encodeDagNode(buildPostDag(updatedRow))).cid;

    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...insertedRow, ipfs_cid: insertedCid }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...insertedRow, ipfs_cid: insertedCid }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...updatedRow, ipfs_cid: updatedCid }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...updatedRow, ipfs_cid: updatedCid }], rowCount: 1 });

    const pool = { query } as unknown as Pool;
    const repository = new PostsRepository(pool);

    const created = await repository.insertPost({
      actor: {
        userId: insertedRow.created_by,
        level: "verified",
        role: "user",
        communityIds: [insertedRow.community_id],
      },
      request: {
        community_id: insertedRow.community_id,
        post_type: "request",
        category: "food",
        title: insertedRow.title,
        body: insertedRow.body,
        language: "en",
        location_zip: insertedRow.location_zip,
        privacy: "community_only",
        expires_at: insertedRow.expires_at,
        contact_pref: { text: true },
      },
      riskLevel: "low",
      status: "active",
      verificationState: "verified_by_anchor",
    });

    const updated = await repository.updatePost({
      postId: insertedRow.post_id,
      request: {
        title: updatedRow.title,
        body: updatedRow.body,
      },
      riskLevel: "low",
      status: "active",
    });

    const reread = await repository.findPost(insertedRow.post_id);

    expect(created.p2pVersion).toBe(1);
    expect(created.ipfsCid).toBe(insertedCid);
    expect(updated?.p2pVersion).toBe(2);
    expect(updated?.ipfsCid).toBe(updatedCid);
    expect(reread?.p2pVersion).toBe(2);
    expect(reread?.ipfsCid).toBe(updatedCid);

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("set ipfs_cid = $2"),
      [insertedRow.post_id, insertedCid]
    );
    expect(query).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining("set ipfs_cid = $2"),
      [insertedRow.post_id, updatedCid]
    );
  });

  it("stamps announcements with persisted p2p_version and CID across list/update/delete paths", async () => {
    const createdRow = {
      announcement_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      community_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "Pantry hours",
      body: "Pantry opens at 9am",
      status: "active" as const,
      is_pinned: true,
      created_by: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      published_at: "2026-04-13T09:00:00.000Z",
      updated_at: "2026-04-13T09:00:00.000Z",
      p2p_version: 1,
      ipfs_cid: null,
    };
    const createdCid = (await encodeDagNode(buildAnnouncementDag(createdRow))).cid;
    const updatedRow = {
      ...createdRow,
      body: "Pantry opens at 10am",
      updated_at: "2026-04-13T11:00:00.000Z",
      p2p_version: 2,
    };
    const updatedCid = (await encodeDagNode(buildAnnouncementDag(updatedRow))).cid;
    const deletedRow = {
      ...updatedRow,
      status: "deleted" as const,
      updated_at: "2026-04-13T12:00:00.000Z",
      p2p_version: 3,
    };
    const deletedCid = (await encodeDagNode(buildAnnouncementDag(deletedRow))).cid;

    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [createdRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...createdRow, ipfs_cid: createdCid }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ ...createdRow, ipfs_cid: createdCid }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...updatedRow, ipfs_cid: updatedCid }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [deletedRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...deletedRow, ipfs_cid: deletedCid }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const pool = { query } as unknown as Pool;
    const repository = new PostsRepository(pool);

    const created = await repository.createAnnouncement({
      actorUserId: createdRow.created_by,
      communityId: createdRow.community_id,
      title: createdRow.title,
      body: createdRow.body,
      isPinned: true,
    });
    const listed = await repository.listAnnouncements({
      communityId: createdRow.community_id,
      includeDeleted: false,
    });
    const updated = await repository.updateAnnouncement({
      communityId: createdRow.community_id,
      announcementId: createdRow.announcement_id,
      body: updatedRow.body,
    });
    const deleted = await repository.deleteAnnouncement({
      communityId: createdRow.community_id,
      announcementId: createdRow.announcement_id,
    });

    expect(created.p2p_version).toBe(1);
    expect(created.ipfs_cid).toBe(createdCid);
    expect(listed[0]?.p2p_version).toBe(1);
    expect(listed[0]?.ipfs_cid).toBe(createdCid);
    expect(updated?.p2p_version).toBe(2);
    expect(updated?.ipfs_cid).toBe(updatedCid);
    expect(deleted?.p2p_version).toBe(3);
    expect(deleted?.ipfs_cid).toBe(deletedCid);

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("set ipfs_cid = $2"),
      [createdRow.announcement_id, createdCid]
    );
    expect(query).toHaveBeenNthCalledWith(
      7,
      expect.stringContaining("set ipfs_cid = $2"),
      [createdRow.announcement_id, updatedCid]
    );
    expect(query).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("set ipfs_cid = $2"),
      [createdRow.announcement_id, deletedCid]
    );
  });
});
