import { createHash } from "node:crypto";

function hashAnchorInviteCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase()).digest("hex");
}

export const seedIds = {
  anonymousUserId: "11111111-1111-4111-8111-111111111111",
  verifiedUserId: "22222222-2222-4222-8222-222222222222",
  anchorUserId: "33333333-3333-4333-8333-333333333333",
  communityId: "44444444-4444-4444-8444-444444444444",
  anchorId: "55555555-5555-4555-8555-555555555555",
  anchorInviteId: "5a5a5a5a-5a5a-455a-855a-5a5a5a5a5a5a",
  inviteAccessCodeId: "56565656-5656-4565-8565-565656565656",
  qrAccessCodeId: "57575757-5757-4575-8575-575757575757",
  rulesetId: "58585858-5858-4585-8585-585858585858",
  announcementId: "59595959-5959-4595-8595-595959595959",
  datasetVersionId: "66666666-6666-4666-8666-666666666666",
  providerId: "77777777-7777-4777-8777-777777777777",
  providerId2: "78787878-7878-4787-8787-787878787878",
  providerId3: "79797979-7979-4797-8797-797979797979",
  requestPostId: "88888888-8888-4888-8888-888888888888",
  offerPostId: "99999999-9999-4999-8999-999999999999",
  pendingReviewPostId: "abababab-abab-4bab-8bab-abababababab",
  suggestionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  contactRequestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  conversationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  messageId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  reportId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  resolvedReportId: "efefefef-efef-4fef-8fef-efefefefefef",
  moderationActionId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  verificationLogId: "12121212-1212-4212-8212-121212121212",
  changeLogId: "34343434-3434-4343-8343-343434343434",

  // Queens (11368 — Corona) pilot community fixtures
  queensCommunityId: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
  queensAnchorId: "a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2",
  queensAnchorInviteId: "a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3",
  queensInviteAccessCodeId: "a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4",
  queensQrAccessCodeId: "a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5",
  queensRulesetId: "a6a6a6a6-a6a6-4a6a-8a6a-a6a6a6a6a6a6",
  queensAnnouncementId: "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7",
  queensAnchorUserId: "a8a8a8a8-a8a8-4a8a-8a8a-a8a8a8a8a8a8",
  queensSeedUserId: "a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9",
  queensProviderIds: [
    "aa010101-0101-4101-8101-010101010101",
    "aa020202-0202-4202-8202-020202020202",
    "aa030303-0303-4303-8303-030303030303",
    "aa040404-0404-4404-8404-040404040404"
  ] as const,
  queensRequestPostId: "ab010101-0101-4101-8101-010101010101",
  queensOfferPostId: "ab020202-0202-4202-8202-020202020202",

  // Bronx (10474 — Hunts Point) pilot community fixtures
  bronxCommunityId: "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1",
  bronxAnchorId: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2",
  bronxAnchorInviteId: "b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3",
  bronxInviteAccessCodeId: "b4b4b4b4-b4b4-4b4b-8b4b-b4b4b4b4b4b4",
  bronxQrAccessCodeId: "b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b5b5",
  bronxRulesetId: "b6b6b6b6-b6b6-4b6b-8b6b-b6b6b6b6b6b6",
  bronxAnnouncementId: "b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b7b7",
  bronxAnchorUserId: "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8",
  bronxSeedUserId: "b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9",
  bronxProviderIds: [
    "ba010101-0101-4101-8101-010101010101",
    "ba020202-0202-4202-8202-020202020202",
    "ba030303-0303-4303-8303-030303030303"
  ] as const,
  bronxRequestPostId: "bb010101-0101-4101-8101-010101010101",
  bronxOfferPostId: "bb020202-0202-4202-8202-020202020202"
} as const;

export const seedValues = {
  communityInviteCode: "FARMINGDALE-HELP",
  communityQrToken: "FARMINGDALE-QR",
  anchorInviteCode: "WEAVE-ANCHOR-11735",
  anchorInviteCodeHash: hashAnchorInviteCode("WEAVE-ANCHOR-11735"),
  anchorTotpSecret: "JBSWY3DPEHPK3PXP",
  anchorTotpSecretCiphertext:
    "AAECAwQFBgcICQoL.9PEJAG8ZtSayC07NMgKepQ._8TUg1U-fKOzerIFHWm2MA",
  anchorRecoveryCodeHashes: [
    "ac3605616950a610bf14d7350d85ff26b461028e7bc7e5011d4edaa84b747b76",
    "1d6d1aae6130d360a657df349b5cb9976f2c24bf18e28d0e6c80ef6922e687ec",
    "e0475c52081d0a3e0d9b76fa3483074a726253a8b70901291b17ef4d5f5b9555"
  ],
  datasetVersion: "cfc_active_2026-04-04",
  datasetSourceLabel: "NYC HRA Community Food Connection",
  datasetSourceUrl: "https://example.org/cfc-active.csv",
  datasetChecksum: "demo_checksum",
  announcementTitle: "Pantry hours updated this week",
  announcementBody:
    "Please check the updated pantry schedule before visiting. Call first if you need a same-day referral.",

  // Queens (11368) pilot community
  queensInviteCode: "QUEENS-CORONA-HELP",
  queensQrToken: "QUEENS-CORONA-QR",
  queensAnchorInviteCode: "WEAVE-ANCHOR-Q113",
  queensAnchorInviteCodeHash: hashAnchorInviteCode("WEAVE-ANCHOR-Q113"),
  queensAnnouncementTitle: "Welcome to the Queens pilot community",
  queensAnnouncementBody:
    "Corona neighbors can now use WeaveNYC to trade requests, offers, and pantry information. Reach out to the anchor for help getting started.",

  // Bronx (10474) pilot community
  bronxInviteCode: "BRONX-HUNTS-POINT-HELP",
  bronxQrToken: "BRONX-HUNTS-POINT-QR",
  bronxAnchorInviteCode: "WEAVE-ANCHOR-BX104",
  bronxAnchorInviteCodeHash: hashAnchorInviteCode("WEAVE-ANCHOR-BX104"),
  bronxAnnouncementTitle: "Welcome to the Bronx pilot community",
  bronxAnnouncementBody:
    "Hunts Point neighbors can now coordinate food and mutual aid requests through WeaveNYC. The anchor is available for verifications and referrals."
} as const;
