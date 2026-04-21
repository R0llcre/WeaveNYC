import {
  anchorMfaStepUpMaxAgeSeconds,
  anchorSessionIdleTtlSeconds
} from "@weavenyc/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

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

/**
 * `requireFreshAnchorMfa` — preHandler that enforces a freshly-verified
 * TOTP step-up on destructive anchor writes (A4 P0-3).
 *
 * The `app.authenticate` hook only checks the JWT's `mfa_verified_at`
 * claim; a stolen access token retains 15 min of destructive authority
 * even if the anchor's TOTP has been revoked or the DB row has aged
 * out. This helper cross-references `anchors.last_mfa_at` against the
 * `anchor_community_id` claim on every destructive call:
 *
 *   1. The anchor row must exist and be active.
 *   2. `last_mfa_at` must be within `anchorSessionIdleTtlSeconds` (so
 *      the overall anchor session is still "live" — 4 h window).
 *   3. `last_mfa_at` must additionally be within
 *      `anchorMfaStepUpMaxAgeSeconds` (15 min) so TOTP step-up is
 *      re-requested frequently enough for destructive ops.
 *
 * On failure respond 401 `{message: "mfa_step_up_required"}` — the PWA /
 * anchor-admin client uses this signal to navigate to the TOTP verify
 * modal and then retry. We emit `message` (not `error`) because the
 * route-level error response schemas are already shaped as
 * `{ message: string }`; adding a second key would break every
 * response validator without giving clients new information.
 */
export function requireFreshAnchorMfa(app: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const claimMfa = request.user.mfa_verified_at;
    const anchorCommunityId = request.user.anchor_community_id;
    const userId = request.user.sub;

    // Reject outright if the claim isn't fresh or the anchor community
    // isn't present — no DB round-trip needed.
    if (!anchorCommunityId) {
      reply.code(401);
      return reply.send({ message: "mfa_step_up_required" });
    }

    if (!claimMfa || !hasFreshAnchorMfa(claimMfa)) {
      reply.code(401);
      return reply.send({ message: "mfa_step_up_required" });
    }

    const claimMfaMs = Date.parse(claimMfa);
    if (Number.isNaN(claimMfaMs) || Date.now() - claimMfaMs > anchorMfaStepUpMaxAgeSeconds * 1000) {
      reply.code(401);
      return reply.send({ message: "mfa_step_up_required" });
    }

    // Cross-check the DB. A stolen JWT can carry a stale
    // `mfa_verified_at` claim but the DB `anchors.last_mfa_at` row is
    // updated atomically whenever a real TOTP step-up succeeds, and
    // would not have advanced past the attacker's JWT cutoff.
    const anchor = await app.userStore.getActiveAnchorByUser(userId, anchorCommunityId);
    if (!anchor || !anchor.lastMfaAt) {
      reply.code(401);
      return reply.send({ message: "mfa_step_up_required" });
    }

    const lastMfaAtMs = Date.parse(anchor.lastMfaAt);
    if (Number.isNaN(lastMfaAtMs)) {
      reply.code(401);
      return reply.send({ message: "mfa_step_up_required" });
    }

    if (Date.now() - lastMfaAtMs > anchorMfaStepUpMaxAgeSeconds * 1000) {
      reply.code(401);
      return reply.send({ message: "mfa_step_up_required" });
    }

    // Also require the JWT claim to match (or predate) the DB row —
    // prevents "my JWT's mfa_verified_at is newer than the DB" replay.
    if (claimMfaMs > lastMfaAtMs + 60_000) {
      reply.code(401);
      return reply.send({ message: "mfa_step_up_required" });
    }
  };
}
