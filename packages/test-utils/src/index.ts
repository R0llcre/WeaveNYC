export async function waitForCondition(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 1_000,
  intervalMs = 25,
) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

export function fixedIsoTimestamp() {
  return "2026-04-04T12:00:00.000Z";
}

export const fixtureIds = {
  anonymousUserId: "11111111-1111-4111-8111-111111111111",
  verifiedUserId: "22222222-2222-4222-8222-222222222222",
  anchorUserId: "33333333-3333-4333-8333-333333333333",
  communityId: "44444444-4444-4444-8444-444444444444",
  anchorId: "55555555-5555-4555-8555-555555555555",
  datasetVersionId: "66666666-6666-4666-8666-666666666666",
  providerId: "77777777-7777-4777-8777-777777777777",
  postId: "88888888-8888-4888-8888-888888888888",
  matchSuggestionId: "99999999-9999-4999-8999-999999999999",
  contactRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  conversationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  messageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  changeLogId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  verificationLogId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  reportId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  moderationActionId: "12121212-1212-4212-8212-121212121212",
} as const;

export const fixtureTimestamps = {
  importedAt: new Date("2026-04-04T12:00:00.000Z"),
  updatedAt: new Date("2026-04-04T12:05:00.000Z"),
  expiresAt: new Date("2026-04-05T12:00:00.000Z"),
} as const;
