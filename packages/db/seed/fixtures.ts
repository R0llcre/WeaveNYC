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
  changeLogId: "34343434-3434-4343-8343-343434343434"
} as const;

export const seedValues = {
  communityInviteCode: "FARMINGDALE-HELP",
  communityQrToken: "FARMINGDALE-QR",
  anchorInviteCode: "WEAVE-ANCHOR-11735",
  anchorInviteCodeHash: "0bfcff2038e295d2c298e1267788eb3809785fd648712c16daa33a4d8f1617f1",
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
    "Please check the updated pantry schedule before visiting. Call first if you need a same-day referral."
} as const;
