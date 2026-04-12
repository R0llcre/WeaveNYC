import { anchorSessionIdleTtlSeconds } from "@weavenyc/shared";
import type { FastifyInstance } from 'fastify';

export async function loadCurrentActor(
  app: FastifyInstance,
  userId: string,
  mfaVerifiedAt?: string,
) {
  const actor = await app.userStore.getAuthUserById(userId);
  if (!actor) {
    return null;
  }

  return {
    ...actor,
    mfaVerifiedAt,
  };
}

function hasFreshAnchorMfa(mfaVerifiedAt?: string) {
  if (!mfaVerifiedAt) {
    return false;
  }

  const occurredAt = Date.parse(mfaVerifiedAt);
  if (Number.isNaN(occurredAt)) {
    return false;
  }

  return Date.now() - occurredAt <= anchorSessionIdleTtlSeconds * 1000;
}

export function isAnchorForCommunity(
  actor: { role: string; anchorCommunityId?: string | null; mfaVerifiedAt?: string },
  communityId: string,
) {
  return (
    actor.role === 'anchor' &&
    actor.anchorCommunityId === communityId &&
    hasFreshAnchorMfa(actor.mfaVerifiedAt)
  );
}
