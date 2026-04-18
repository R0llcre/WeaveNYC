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
  generateIdentitySalt,
  hashEmailIdentity,
  hashPhoneIdentity,
  maskEmailAddress
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

interface StartDeleteChallengeInput {
  userId: string;
  phoneBound: boolean;
  emailBound: boolean;
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

export const accountRoutes: FastifyPluginAsync = async (app) => {
  const smsProvider = createSmsVerificationProvider(app);
  const emailProvider = createMagicLinkVerificationProvider(app);

  async function startDeleteChallenge(
    input: StartDeleteChallengeInput
  ): Promise<StartDeleteChallengeResult> {
    const deliveryChannel: IdentityChallengeDeliveryChannel | null = input.phoneBound
      ? 'sms'
      : input.emailBound
        ? 'email'
        : null;

    if (!deliveryChannel) {
      return { status: 'no_identity' };
    }

    const challengeId = randomUUID();
    const identitySalt = generateIdentitySalt();

    if (deliveryChannel === 'sms') {
      // The notification service resolves the actual phone number from
      // user_id via its own records; the API gateway never holds the raw
      // number. The local `phonePlaceholder` feeds hashPhoneIdentity only to
      // keep the stored challenge shape consistent with OTP flow; it is not
      // dialled anywhere. Stub providers return the demo code for tests.
      const phonePlaceholder = `user:${input.userId}`;
      const code = createOtpCode();
      const identityHash = hashPhoneIdentity(
        phonePlaceholder,
        identitySalt,
        app.config.identityHashPepper
      );
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
      const delivery = await smsProvider.sendOtp({
        phone: phonePlaceholder,
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
        demoCode: delivery.demoCode ?? code
      };
    }

    const emailPlaceholder = `user+${input.userId}@weavenyc.local`;
    const token = createMagicLinkToken();
    const identityHash = hashEmailIdentity(
      emailPlaceholder,
      identitySalt,
      app.config.identityHashPepper
    );
    const maskedDestination = maskEmailAddress(emailPlaceholder);
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
      email: emailPlaceholder,
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
      demoToken: delivery.demoToken ?? token,
      demoUrl: delivery.demoUrl
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
          message:
            'cannot_verify_identity: bind a phone number or email before deleting your account'
        };
      }

      const result = await startDeleteChallenge({
        userId,
        phoneBound: identity.hasPhoneHash,
        emailBound: identity.hasEmailHash
      });

      if (result.status === 'no_identity') {
        recordAccountDeletion(app, 'rejected');
        reply.code(409);
        return {
          message:
            'cannot_verify_identity: bind a phone number or email before deleting your account'
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
          409: errorResponseSchema,
          410: errorResponseSchema,
          429: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      void accountUndeleteRequestRequestSchema;
      const userId = request.body.user_id;

      const decision = await app.authAbuseStore.checkAccountDeleteRequest(userId);
      if (!decision.allowed) {
        reply
          .code(429)
          .header('retry-after', decision.retryAfterSeconds.toString());
        return {
          message: `Too many undelete requests. Retry in ${decision.retryAfterSeconds}s.`
        };
      }

      const identity = await app.userStore.getDeletionIdentity(userId);
      if (!identity) {
        reply.code(404);
        return { message: 'User not found.' };
      }

      if (identity.status !== 'deleted') {
        reply.code(409);
        return { message: 'Account is not in a restorable state.' };
      }

      if (!identity.purgeAt || new Date(identity.purgeAt).getTime() <= Date.now()) {
        reply.code(410);
        return { message: 'Account is past its purge date and cannot be restored.' };
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
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          410: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      void accountUndeleteConfirmRequestSchema;
      const { user_id: userId, recovery_token: recoveryToken } = request.body;

      const identity = await app.userStore.getDeletionIdentity(userId);
      if (!identity) {
        reply.code(404);
        return { message: 'User not found.' };
      }

      if (identity.status !== 'deleted') {
        reply.code(409);
        return { message: 'Account is not in a restorable state.' };
      }

      if (!identity.purgeAt || new Date(identity.purgeAt).getTime() <= Date.now()) {
        reply.code(410);
        return { message: 'Account is past its purge date and cannot be restored.' };
      }

      const tokenHash = hashRecoveryToken(recoveryToken);
      const verification = await app.refreshTokenStore.verifyChallenge({
        challengeId: undeleteRecoveryChallengeId(userId, tokenHash),
        kind: 'account_undelete',
        codeOrToken: tokenHash
      });

      if (verification.status !== 'verified' || verification.challenge.userId !== userId) {
        reply.code(400);
        return { message: 'Recovery token is invalid or already used.' };
      }

      const restored = await app.userStore.undeleteAccount({ userId });
      if (!restored) {
        recordAccountDeletion(app, 'rejected');
        reply.code(410);
        return { message: 'Account is past its purge date and cannot be restored.' };
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
