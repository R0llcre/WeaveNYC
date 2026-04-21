import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  magicLinkChallengeTtlSeconds,
  otpChallengeTtlSeconds,
  otpMaxAttempts
} from '@weavenyc/shared';
import type { FastifyPluginAsync } from 'fastify';

import {
  accountDeleteConfirmRequestSchema,
  accountDeleteConfirmResponseSchema,
  accountDeleteRequestRequestSchema,
  accountDeleteRequestResponseSchema,
  accountUndeleteConfirmRequestSchema,
  accountUndeleteConfirmResponseSchema,
  accountUndeleteRequestRequestSchema,
  accountUndeleteRequestResponseSchema,
  errorResponseSchema
} from '../contracts.js';
import type { AccountDeleteReason } from '@weavenyc/shared';
import type {
  IdentityChallengeDeliveryChannel,
  StoredIdentityChallenge
} from '../lib/refresh-token-store.js';
import {
  createOtpCode,
  hashClientIpAddress
} from '../lib/identity.js';
import {
  createMagicLinkVerificationProvider,
  createSmsVerificationProvider
} from '../lib/notification-delivery.js';
import { recordAccountDeletion } from '../lib/metrics.js';
import { createMagicLinkToken } from '../lib/verification-providers.js';

const accountPurgeRetentionDays = 30;

function computePurgeDate(now: Date): string {
  const purgeAt = new Date(now);
  purgeAt.setUTCDate(purgeAt.getUTCDate() + accountPurgeRetentionDays);
  return purgeAt.toISOString();
}

interface StoredIdentity {
  phoneHash: string | null;
  phoneHashSalt: string | null;
  emailHash: string | null;
  emailHashSalt: string | null;
}

interface StartDeleteChallengeInput {
  userId: string;
  identity: StoredIdentity;
  includeDemoCode: boolean;
}

interface StartDeleteChallengeSuccess {
  status: 'issued';
  challengeId: string;
  maskedDestination: string;
  deliveryChannel: IdentityChallengeDeliveryChannel;
  expiresInSeconds: number;
  fallback?: boolean;
  demoCode?: string;
  demoToken?: string;
  demoUrl?: string;
}

type StartDeleteChallengeResult = StartDeleteChallengeSuccess | { status: 'no_identity' };

/**
 * Prefix used when stashing a single-use undelete recovery token in the same
 * Redis-backed store we use for OTP / magic-link challenges. The token itself
 * is never written in plaintext; only its sha256 hash is persisted.
 */
const undeleteRecoveryChallengeId = (userId: string, tokenHash: string) =>
  `undelete-${userId}-${tokenHash}`;

/**
 * Opaque "not available" response shared by every non-200 branch of the
 * undelete endpoints. Collapsing 404/409/410/not-restorable into a single
 * shape prevents the "does this user_id exist?" enumeration vector
 * (A1 P1-11). Only a genuine success returns 200.
 */
const recoveryNotAvailableResponse = {
  message: 'recovery_not_available'
} as const;

export const accountRoutes: FastifyPluginAsync = async (app) => {
  const smsProvider = createSmsVerificationProvider(app);
  const emailProvider = createMagicLinkVerificationProvider(app);

  async function startDeleteChallenge(
    input: StartDeleteChallengeInput
  ): Promise<StartDeleteChallengeResult> {
    const deliveryChannel: IdentityChallengeDeliveryChannel | null = input.identity.phoneHash
      ? 'sms'
      : input.identity.emailHash
        ? 'email'
        : null;

    if (!deliveryChannel) {
      return { status: 'no_identity' };
    }

    const challengeId = randomUUID();

    if (deliveryChannel === 'sms') {
      // SECURITY: the challenge's `identityHash` and `identitySalt` are the
      // user's ACTUAL stored hash on the `users` table (not a placeholder).
      // At `/confirm` we re-read the user row and reject if the hash has
      // rotated since issuance — this blocks a stolen-token holder from
      // confirming a challenge that was delivered to the user's old phone
      // after the user rotated it (A1 P0-14).
      const identityHash = input.identity.phoneHash!;
      const identitySalt = input.identity.phoneHashSalt!;
      const code = createOtpCode();
      const maskedDestination = `phone on file (***${input.userId.slice(-4)})`;
      const challenge: StoredIdentityChallenge = {
        challengeId,
        kind: 'account_delete',
        userId: input.userId,
        identityHash,
        identitySalt,
        abuseHash: null,
        maskedDestination,
        deliveryChannel,
        codeOrToken: code,
        attemptsRemaining: otpMaxAttempts,
        expiresAt: Date.now() + otpChallengeTtlSeconds * 1000
      };

      await app.refreshTokenStore.createAccountLifecycleChallenge(challenge);
      // The `userId` is passed to the notification service so the real
      // phone number can be resolved on that side — the API gateway never
      // holds the raw number. No raw phone placeholder is synthesized.
      const delivery = await smsProvider.sendOtp({
        userId: input.userId,
        code,
        challengeId
      });

      return {
        status: 'issued',
        challengeId,
        maskedDestination,
        deliveryChannel,
        expiresInSeconds: otpChallengeTtlSeconds,
        fallback: delivery.fallback,
        // SECURITY: `demo_code` leaks the OTP over HTTP and lets any
        // access-token holder delete the account directly from the
        // response body. Only return it in non-production so tests /
        // pilot QA still work (A1 P0-14).
        ...(input.includeDemoCode ? { demoCode: delivery.demoCode ?? code } : {})
      };
    }

    const identityHash = input.identity.emailHash!;
    const identitySalt = input.identity.emailHashSalt!;
    const token = createMagicLinkToken();
    // We only have the email *hash* on the gateway — the plaintext lives
    // in the notification service. Use a user-scoped placeholder mask so
    // the UI can render a safe, non-leaky destination label.
    const maskedDestination = `email on file (user ${input.userId.slice(-6)})`;
    const challenge: StoredIdentityChallenge = {
      challengeId,
      kind: 'account_delete',
      userId: input.userId,
      identityHash,
      identitySalt,
      abuseHash: null,
      maskedDestination,
      deliveryChannel,
      codeOrToken: token,
      attemptsRemaining: 1,
      expiresAt: Date.now() + magicLinkChallengeTtlSeconds * 1000
    };

    await app.refreshTokenStore.createAccountLifecycleChallenge(challenge);
    const delivery = await emailProvider.sendMagicLink({
      userId: input.userId,
      challengeId,
      token
    });

    return {
      status: 'issued',
      challengeId,
      maskedDestination,
      deliveryChannel,
      expiresInSeconds: magicLinkChallengeTtlSeconds,
      fallback: delivery.fallback,
      ...(input.includeDemoCode
        ? {
            demoToken: delivery.demoToken ?? token,
            demoUrl: delivery.demoUrl
          }
        : {})
    };
  }

  app.post<{ Body: Record<string, never> }>(
    '/v1/account/delete/request',
    {
      schema: {
        summary:
          'Step 1: issue an OTP/magic-link challenge to delete the authenticated account',
        tags: ['account'],
        security: [{ bearerAuth: [] }],
        body: accountDeleteRequestRequestSchema,
        response: {
          200: accountDeleteRequestResponseSchema,
          409: errorResponseSchema,
          429: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const userId = request.user.sub;

      const decision = await app.authAbuseStore.checkAccountDeleteRequest(userId);
      if (!decision.allowed) {
        recordAccountDeletion(app, 'rate_limited');
        reply
          .code(429)
          .header('retry-after', decision.retryAfterSeconds.toString());
        return {
          message: `Too many account deletion requests. Retry in ${decision.retryAfterSeconds}s.`
        };
      }

      const identity = await app.userStore.getDeletionIdentity(userId);
      if (!identity) {
        recordAccountDeletion(app, 'not_found');
        reply.code(409);
        return { message: 'Account no longer exists.' };
      }

      if (identity.status === 'deleted') {
        recordAccountDeletion(app, 'rejected');
        reply.code(409);
        return { message: 'Account is already scheduled for deletion.' };
      }

      if (!identity.hasPhoneHash && !identity.hasEmailHash) {
        recordAccountDeletion(app, 'rejected');
        reply.code(409);
        return {
          message: 'no_verified_identity'
        };
      }

      const result = await startDeleteChallenge({
        userId,
        identity: {
          phoneHash: identity.phoneHash,
          phoneHashSalt: identity.phoneHashSalt,
          emailHash: identity.emailHash,
          emailHashSalt: identity.emailHashSalt
        },
        includeDemoCode: app.config.env !== 'production'
      });

      if (result.status === 'no_identity') {
        recordAccountDeletion(app, 'rejected');
        reply.code(409);
        return {
          message: 'no_verified_identity'
        };
      }

      recordAccountDeletion(app, 'issued');
      return {
        challenge_id: result.challengeId,
        masked_destination: result.maskedDestination,
        delivery_channel: result.deliveryChannel,
        expires_in_seconds: result.expiresInSeconds,
        fallback: result.fallback,
        demo_code: result.demoCode,
        demo_token: result.demoToken,
        demo_url: result.demoUrl
      };
    }
  );

  app.post<{
    Body: {
      challenge_id: string;
      code: string;
      reason?: AccountDeleteReason;
    };
  }>(
    '/v1/account/delete/confirm',
    {
      schema: {
        summary:
          'Step 2: verify the challenge, run last-anchor safety checks, and soft-delete the account',
        tags: ['account'],
        security: [{ bearerAuth: [] }],
        body: accountDeleteConfirmRequestSchema,
        response: {
          202: {
            ...accountDeleteConfirmResponseSchema,
            required: [...accountDeleteConfirmResponseSchema.required],
            properties: {
              ...accountDeleteConfirmResponseSchema.properties,
              undelete_recovery_token: { type: 'string' }
            }
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const userId = request.user.sub;
      const challengeResult = await app.refreshTokenStore.verifyChallenge({
        challengeId: request.body.challenge_id,
        kind: 'account_delete',
        codeOrToken: request.body.code
      });

      if (challengeResult.status === 'exhausted') {
        reply.code(400);
        return { message: 'Verification code exhausted. Start a new request.' };
      }

      if (challengeResult.status !== 'verified') {
        if (challengeResult.status === 'invalid') {
          reply.code(400);
          return { message: 'Verification code is not correct.' };
        }
        reply.code(400);
        return {
          message: 'Verification challenge is no longer valid. Start a new request.'
        };
      }

      if (challengeResult.challenge.userId !== userId) {
        reply.code(400);
        return { message: 'Verification challenge does not belong to this user.' };
      }

      // SECURITY: re-read the user's current identity hashes and require
      // that the challenge's bound hash still matches. If the user rotated
      // their phone/email between `/request` and `/confirm`, the challenge
      // is stale and must not proceed — this prevents a token-holder from
      // confirming a challenge that was actually delivered to the user's
      // old identity on record (A1 P0-14).
      const currentIdentity = await app.userStore.getDeletionIdentity(userId);
      if (!currentIdentity) {
        reply.code(409);
        return { message: 'Account no longer exists.' };
      }
      const challengeChannel = challengeResult.challenge.deliveryChannel;
      const currentHash =
        challengeChannel === 'sms'
          ? currentIdentity.phoneHash
          : challengeChannel === 'email'
            ? currentIdentity.emailHash
            : null;
      if (!currentHash || currentHash !== challengeResult.challenge.identityHash) {
        reply.code(401);
        return {
          message: 'identity_changed_reverify_required'
        };
      }

      const anchorCommunityIds =
        await app.userStore.listActiveAnchorCommunitiesForUser(userId);
      for (const communityId of anchorCommunityIds) {
        const remaining = await app.userStore.countActiveAnchorsInCommunity(
          communityId,
          userId
        );
        if (remaining === 0) {
          reply.code(409);
          return {
            message: `last_anchor_blocks_delete: community ${communityId} has no replacement anchor. Ask another anchor or Weave staff to take over before deleting.`
          };
        }
      }

      const purgeAt = computePurgeDate(new Date());
      const deletion = await app.userStore.confirmAccountDeletion({
        userId,
        reason: request.body.reason,
        purgeAt
      });

      if (!deletion) {
        recordAccountDeletion(app, 'rejected');
        reply.code(409);
        return { message: 'Account is already deleted or does not exist.' };
      }

      const recoveryToken = issueUndeleteRecoveryToken(userId);
      const recoveryTokenHash = hashRecoveryToken(recoveryToken);
      const ttlMs = Math.max(
        new Date(purgeAt).getTime() - Date.now(),
        60_000
      );
      const recoveryChallenge: StoredIdentityChallenge = {
        challengeId: undeleteRecoveryChallengeId(userId, recoveryTokenHash),
        kind: 'account_undelete',
        userId,
        identityHash: recoveryTokenHash,
        identitySalt: 'undelete-recovery',
        abuseHash: null,
        maskedDestination: 'recovery token (issued once)',
        deliveryChannel: 'email',
        codeOrToken: recoveryTokenHash,
        attemptsRemaining: 1,
        expiresAt: Date.now() + ttlMs
      };
      await app.refreshTokenStore.createAccountLifecycleChallenge(recoveryChallenge);

      await app.refreshTokenStore.revokeUserSessions(userId);

      try {
        await app.analyticsRecorder?.recordEvent({
          event_type: 'account_deleted',
          actor_user_id: userId,
          payload: {
            reason: request.body.reason ?? null,
            had_anchor_role: deletion.hadAnchorRole
          }
        });
      } catch {
        // analytics is best-effort; never block a delete
      }

      recordAccountDeletion(app, 'scheduled');
      reply.code(202);
      return {
        status: 'deletion_scheduled',
        purge_date: deletion.purgeAt,
        user_id: deletion.userId,
        undelete_recovery_token: recoveryToken
      };
    }
  );

  app.post<{
    Body: { user_id: string };
  }>(
    '/v1/account/undelete/request',
    {
      schema: {
        summary:
          'Confirm that a soft-deleted account is still within its 30-day recovery window',
        tags: ['account'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['user_id'],
          properties: {
            user_id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: accountUndeleteRequestResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      void accountUndeleteRequestRequestSchema;
      const userId = request.body.user_id;

      // SECURITY: rate-limit by caller IP, not body-supplied `user_id`.
      // Keying on `user_id` was trivially bypassed by rotating the
      // parameter, turning this endpoint into a user-existence oracle
      // (A1 P1-11). The IP bucket also generously covers a user
      // mis-typing their token on a couple of devices.
      const ipHash = hashClientIpAddress(request.ip, app.config.identityHashPepper);
      const decision = await app.authAbuseStore.checkUndeleteRequest(ipHash);
      if (!decision.allowed) {
        reply
          .code(429)
          .header('retry-after', decision.retryAfterSeconds.toString());
        return {
          message: `Too many undelete requests. Retry in ${decision.retryAfterSeconds}s.`
        };
      }

      const identity = await app.userStore.getDeletionIdentity(userId);
      // SECURITY: collapse every non-success branch (unknown user,
      // wrong status, past purge) into a single opaque 404 so an
      // attacker can't probe for valid `user_id`s. Only a genuine
      // success returns 200 (A1 P1-11).
      if (!identity || identity.status !== 'deleted' || !identity.purgeAt) {
        reply.code(404);
        return recoveryNotAvailableResponse;
      }

      if (new Date(identity.purgeAt).getTime() <= Date.now()) {
        reply.code(404);
        return recoveryNotAvailableResponse;
      }

      return {
        challenge_id: randomUUID(),
        masked_destination: 'recovery token (issued at deletion)',
        delivery_channel: 'email',
        expires_in_seconds: Math.max(
          Math.floor((new Date(identity.purgeAt).getTime() - Date.now()) / 1000),
          60
        ),
        fallback: true
      };
    }
  );

  app.post<{
    Body: {
      user_id: string;
      recovery_token: string;
    };
  }>(
    '/v1/account/undelete',
    {
      schema: {
        summary:
          'Restore a soft-deleted account using the recovery token issued at delete time',
        tags: ['account'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['user_id', 'recovery_token'],
          properties: {
            user_id: { type: 'string', format: 'uuid' },
            recovery_token: { type: 'string', minLength: 10, maxLength: 256 }
          }
        },
        response: {
          200: accountUndeleteConfirmResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      void accountUndeleteConfirmRequestSchema;
      const { user_id: userId, recovery_token: recoveryToken } = request.body;

      // IP-bucket this call too so a token-grind attack can't just
      // bypass the `/request` gate by going straight here.
      const ipHash = hashClientIpAddress(request.ip, app.config.identityHashPepper);
      const decision = await app.authAbuseStore.checkUndeleteRequest(ipHash);
      if (!decision.allowed) {
        reply
          .code(429)
          .header('retry-after', decision.retryAfterSeconds.toString());
        return {
          message: `Too many undelete attempts. Retry in ${decision.retryAfterSeconds}s.`
        };
      }

      const identity = await app.userStore.getDeletionIdentity(userId);
      if (!identity || identity.status !== 'deleted' || !identity.purgeAt) {
        reply.code(404);
        return recoveryNotAvailableResponse;
      }

      if (new Date(identity.purgeAt).getTime() <= Date.now()) {
        reply.code(404);
        return recoveryNotAvailableResponse;
      }

      const tokenHash = hashRecoveryToken(recoveryToken);
      const verification = await app.refreshTokenStore.verifyChallenge({
        challengeId: undeleteRecoveryChallengeId(userId, tokenHash),
        kind: 'account_undelete',
        codeOrToken: tokenHash
      });

      if (verification.status !== 'verified' || verification.challenge.userId !== userId) {
        reply.code(404);
        return recoveryNotAvailableResponse;
      }

      const restored = await app.userStore.undeleteAccount({ userId });
      if (!restored) {
        recordAccountDeletion(app, 'rejected');
        reply.code(404);
        return recoveryNotAvailableResponse;
      }

      recordAccountDeletion(app, 'restored');

      try {
        await app.analyticsRecorder?.recordEvent({
          event_type: 'account_undeleted',
          actor_user_id: userId,
          payload: {}
        });
      } catch {
        // analytics is best-effort
      }

      return {
        status: 'restored',
        user_id: restored.userId
      };
    }
  );
};

function issueUndeleteRecoveryToken(userId: string): string {
  const random = randomBytes(24).toString('base64url');
  return `uri_${userId.slice(0, 8)}_${random}`;
}

function hashRecoveryToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
