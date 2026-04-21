import { createHash, randomUUID } from "node:crypto";

import {
  anchorActivationChallengeTtlSeconds,
  anchorSessionChallengeTtlSeconds,
  magicLinkChallengeTtlSeconds,
  otpChallengeTtlSeconds,
  otpMaxAttempts,
  totpMaxAttempts
} from "@weavenyc/shared";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
  anchorActivateConfirmRequestSchema,
  anchorActivateRequestSchema,
  anchorActivateResponseSchema,
  anchorSessionRecoveryErrorResponseSchema,
  anchorSessionRecoveryRequestSchema,
  anchorSessionRecoveryResponseSchema,
  anchorSessionStartRequestSchema,
  anchorSessionStartResponseSchema,
  anchorSessionVerifyRequestSchema,
  anonymousAuthRequestSchema,
  anonymousAuthResponseSchema,
  errorResponseSchema,
  magicLinkStartRequestSchema,
  magicLinkStartResponseSchema,
  magicLinkVerifyRequestSchema,
  otpStartRequestSchema,
  otpStartResponseSchema,
  otpVerifyRequestSchema,
  refreshSessionRequestSchema
} from "../contracts.js";
import {
  buildStoredRefreshSession,
  type StoredAnchorChallenge,
  type StoredIdentityChallenge
} from "../lib/refresh-token-store.js";
import { recordAuthChallenge } from "../lib/metrics.js";
import { decryptSecret, encryptSecret } from "../lib/secret-cipher.js";
import { createOpaqueRefreshToken, signAccessToken } from "../lib/tokens.js";
import {
  type AuthAbuseStore,
  createOtpCode,
  generateIdentitySalt,
  hashEmailIdentity,
  hashPhoneAbuseKey,
  hashPhoneIdentity,
  maskEmailAddress,
  maskPhoneNumber,
  normalizeEmail,
  normalizePhoneNumber
} from "../lib/identity.js";
import { buildOtpAuthUri, generateRecoveryCodes, generateTotpSecret, verifyTotpCode } from "../lib/totp.js";
import {
  createMagicLinkToken,
} from "../lib/verification-providers.js";
import {
  createMagicLinkVerificationProvider,
  createSmsVerificationProvider
} from "../lib/notification-delivery.js";
import type { AuthenticatedUserRecord } from "../types.js";

type AnonymousAuthBody = {
  device_id: string;
};

type RefreshSessionBody = {
  refresh_token: string;
};

type OtpStartBody = {
  phone: string;
};

type OtpVerifyBody = {
  challenge_id: string;
  code: string;
};

type MagicLinkStartBody = {
  email: string;
};

type MagicLinkVerifyBody = {
  challenge_id: string;
  token: string;
};

type AnchorActivateBody = {
  invite_code: string;
};

type AnchorActivateConfirmBody = {
  activation_id: string;
  totp_code: string;
};

type AnchorSessionStartBody = {
  community_id: string;
};

type AnchorSessionVerifyBody = {
  challenge_id: string;
  totp_code: string;
};

type LogoutBody = {
  revoke_all_devices?: boolean;
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  const authAbuseStore = getAuthAbuseStore(app);
  const smsProvider = createSmsVerificationProvider(app);
  const emailProvider = createMagicLinkVerificationProvider(app);

  app.post<{ Body: AnonymousAuthBody }>(
    "/v1/auth/anonymous",
    {
      schema: {
        summary: "Create an anonymous authenticated session",
        tags: ["auth"],
        body: anonymousAuthRequestSchema,
        response: {
          200: anonymousAuthResponseSchema,
          429: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const anonymousDecision = await authAbuseStore.checkAnonymousAuth(request.ip);
      if (!anonymousDecision.allowed) {
        recordAuthChallenge(app, "anonymous", "rate_limited");
        reply.code(429);
        return {
          message: `Too many anonymous session attempts. Retry in ${anonymousDecision.retryAfterSeconds}s.`
        };
      }

      const user = await app.userStore.createAnonymousUser(request.body.device_id);
      recordAuthChallenge(app, "anonymous", "issued");
      return issueSessionResponse(app, user, "anonymous");
    }
  );

  app.post<{ Body: RefreshSessionBody }>(
    "/v1/auth/refresh",
    {
      schema: {
        summary: "Rotate a refresh token and mint a new session",
        tags: ["auth"],
        body: refreshSessionRequestSchema,
        response: {
          200: anonymousAuthResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const refreshInspection = await app.refreshTokenStore.inspectSession(request.body.refresh_token);
      if (refreshInspection.status === "active") {
        const refreshDecision = await authAbuseStore.checkRefreshAttempt(
          refreshInspection.session.userId
        );
        if (!refreshDecision.allowed) {
          reply.code(429);
          return {
            message: `Too many refresh attempts. Retry in ${refreshDecision.retryAfterSeconds}s.`
          };
        }
      }

      const currentUser =
        refreshInspection.status === "active"
          ? await app.userStore.getAuthUserById(refreshInspection.session.userId)
          : null;
      if (refreshInspection.status === "active" && (!currentUser || currentUser.status !== "active")) {
        await app.refreshTokenStore.revokeUserSessions(refreshInspection.session.userId);
        reply.code(401);
        return {
          message: "Refresh token is not valid"
        };
      }

      const refreshUser =
        refreshInspection.status === "active" && currentUser
          ? buildRefreshSessionUser(currentUser, refreshInspection.session)
          : null;
      if (refreshInspection.status === "active" && !refreshUser) {
        await app.refreshTokenStore.revokeUserSessions(refreshInspection.session.userId);
        reply.code(401);
        return {
          message: "Refresh token is not valid"
        };
      }

      const nextRefreshSession =
        refreshInspection.status === "active" && refreshUser
          ? buildStoredRefreshSession({
              userId: refreshUser.userId,
              level: refreshUser.level,
              role: refreshUser.role,
              communityIds: refreshUser.communityIds,
              anchorCommunityId: refreshUser.anchorCommunityId ?? null,
              mfaVerifiedAt: refreshUser.mfaVerifiedAt,
              lastActivityAt:
                refreshUser.level === "anchor" ? new Date().toISOString() : undefined,
              familyId: refreshInspection.session.familyId
            })
          : undefined;

      const nextRefreshToken = createOpaqueRefreshToken();
      const rotation = await app.refreshTokenStore.rotateSession(
        request.body.refresh_token,
        nextRefreshToken,
        nextRefreshSession
      );

      if (rotation.status !== "rotated") {
        recordAuthChallenge(
          app,
          "refresh",
          rotation.status === "replayed" ? "exhausted" : "rejected",
        );
        reply.code(401);
        return {
          message:
            rotation.status === "replayed"
              ? "Refresh token replay detected"
              : "Refresh token is not valid"
        };
      }

      recordAuthChallenge(app, "refresh", "verified");
      return {
        access_token: signAccessToken(app, {
          userId: rotation.session.userId,
          level: rotation.session.level,
          role: rotation.session.role,
          status: "active",
          communityIds: rotation.session.communityIds,
          anchorCommunityId: rotation.session.anchorCommunityId,
          mfaVerifiedAt: rotation.session.mfaVerifiedAt
        }),
        refresh_token: nextRefreshToken,
        issued_via: "refresh",
        user: {
          user_id: rotation.session.userId,
          level: rotation.session.level
        }
      };
    }
  );

  app.post<{ Body: OtpStartBody }>(
    "/v1/auth/otp/start",
    {
      schema: {
        summary: "Start phone verification for the current session",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: otpStartRequestSchema,
        response: {
          200: otpStartResponseSchema,
          400: errorResponseSchema,
          429: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      try {
        const normalizedPhone = normalizePhoneNumber(request.body.phone);
        const identitySalt = generateIdentitySalt();
        const identityHash = hashPhoneIdentity(
          normalizedPhone,
          identitySalt,
          app.config.identityHashPepper
        );
        const abuseHash = hashPhoneAbuseKey(
          normalizedPhone,
          app.config.identityHashPepper
        );
        const otpDecision = await authAbuseStore.checkOtpStart(request.user.sub, abuseHash);
        if (!otpDecision.allowed) {
          recordAuthChallenge(app, "otp_start", "rate_limited");
          reply.code(429);
          return {
            message: `OTP temporarily unavailable. Retry in ${otpDecision.retryAfterSeconds}s.`
          };
        }

        const challengeId = randomUUID();
        const code = createOtpCode();
        const challenge: StoredIdentityChallenge = {
          challengeId,
          kind: "otp",
          userId: request.user.sub,
          identityHash,
          identitySalt,
          abuseHash,
          maskedDestination: maskPhoneNumber(normalizedPhone),
          codeOrToken: code,
          attemptsRemaining: otpMaxAttempts,
          expiresAt: Date.now() + otpChallengeTtlSeconds * 1000
        };

        await app.refreshTokenStore.createOtpChallenge(challenge);
        const delivery = await smsProvider.sendOtp({
          phone: normalizedPhone,
          code,
          challengeId
        });
        recordAuthChallenge(app, "otp_start", "issued");

        return {
          challenge_id: challengeId,
          masked_destination: challenge.maskedDestination,
          delivery_channel: "sms",
          expires_in_seconds: otpChallengeTtlSeconds,
          fallback: delivery.fallback,
          demo_code: delivery.demoCode
        };
      } catch (error) {
        recordAuthChallenge(app, "otp_start", "error");
        reply.code(400);
        return {
          message: error instanceof Error ? error.message : "Unable to start OTP verification"
        };
      }
    }
  );

  app.post<{ Body: OtpVerifyBody }>(
    "/v1/auth/otp/verify",
    {
      schema: {
        summary: "Verify an OTP and upgrade the current session",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: otpVerifyRequestSchema,
        response: {
          200: anonymousAuthResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const challengeResult = await app.refreshTokenStore.verifyChallenge({
        challengeId: request.body.challenge_id,
        kind: "otp",
        codeOrToken: request.body.code
      });

      if (challengeResult.status === "exhausted") {
        await authAbuseStore.activateOtpCooldown(
          challengeResult.challenge.abuseHash ?? challengeResult.challenge.identityHash
        );
        recordAuthChallenge(app, "otp_verify", "exhausted");
        reply.code(400);
        return {
          message: "OTP challenge is not valid"
        };
      }

      if (challengeResult.status !== "verified" || challengeResult.challenge.userId !== request.user.sub) {
        recordAuthChallenge(app, "otp_verify", "rejected");
        reply.code(400);
        return {
          message: "OTP challenge is not valid"
        };
      }

      const user = await app.userStore.verifyUserPhone(
        request.user.sub,
        challengeResult.challenge.identityHash,
        challengeResult.challenge.identitySalt
      );

      if (!user) {
        recordAuthChallenge(app, "otp_verify", "not_found");
        reply.code(404);
        return {
          message: "User not found"
        };
      }

      await app.refreshTokenStore.revokeUserSessions(request.user.sub);
      recordAuthChallenge(app, "otp_verify", "verified");
      return issueSessionResponse(app, user, "otp", true);
    }
  );

  app.post<{ Body: MagicLinkStartBody }>(
    "/v1/auth/magic-link/start",
    {
      schema: {
        summary: "Start magic-link fallback verification for the current session",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: magicLinkStartRequestSchema,
        response: {
          200: magicLinkStartResponseSchema,
          400: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      try {
        const normalizedEmail = normalizeEmail(request.body.email);
        const identitySalt = generateIdentitySalt();
        const identityHash = hashEmailIdentity(
          normalizedEmail,
          identitySalt,
          app.config.identityHashPepper
        );
        const challengeId = randomUUID();
        const token = createMagicLinkToken();
        const challenge: StoredIdentityChallenge = {
          challengeId,
          kind: "magic_link",
          userId: request.user.sub,
          identityHash,
          identitySalt,
          abuseHash: null,
          maskedDestination: maskEmailAddress(normalizedEmail),
          codeOrToken: token,
          attemptsRemaining: 1,
          expiresAt: Date.now() + magicLinkChallengeTtlSeconds * 1000
        };

        await app.refreshTokenStore.createMagicLinkChallenge(challenge);
        const delivery = await emailProvider.sendMagicLink({
          email: normalizedEmail,
          challengeId,
          token
        });
        recordAuthChallenge(app, "magic_link_start", "issued");

        return {
          challenge_id: challengeId,
          masked_destination: challenge.maskedDestination,
          delivery_channel: "email",
          expires_in_seconds: magicLinkChallengeTtlSeconds,
          fallback: delivery.fallback,
          demo_token: delivery.demoToken,
          demo_url: delivery.demoUrl
        };
      } catch (error) {
        recordAuthChallenge(app, "magic_link_start", "error");
        reply.code(400);
        return {
          message: error instanceof Error ? error.message : "Unable to start magic-link verification"
        };
      }
    }
  );

  app.post<{ Body: MagicLinkVerifyBody }>(
    "/v1/auth/magic-link/verify",
    {
      schema: {
        summary: "Verify a magic-link challenge and upgrade the current session",
        tags: ["auth"],
        body: magicLinkVerifyRequestSchema,
        response: {
          200: anonymousAuthResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const challengeResult = await app.refreshTokenStore.verifyChallenge({
        challengeId: request.body.challenge_id,
        kind: "magic_link",
        codeOrToken: request.body.token
      });

      if (challengeResult.status !== "verified") {
        recordAuthChallenge(app, "magic_link_verify", "rejected");
        reply.code(400);
        return {
          message: "Magic-link challenge is not valid"
        };
      }

      const user = await app.userStore.verifyUserEmail(
        challengeResult.challenge.userId,
        challengeResult.challenge.identityHash,
        challengeResult.challenge.identitySalt
      );

      if (!user) {
        recordAuthChallenge(app, "magic_link_verify", "not_found");
        reply.code(404);
        return {
          message: "User not found"
        };
      }

      await app.refreshTokenStore.revokeUserSessions(challengeResult.challenge.userId);
      recordAuthChallenge(app, "magic_link_verify", "verified");
      return issueSessionResponse(app, user, "magic_link", true);
    }
  );

  app.post<{ Body: AnchorActivateBody }>(
    "/v1/auth/anchor/activate",
    {
      schema: {
        summary: "Start anchor activation with an invite code and TOTP enrollment",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: anchorActivateRequestSchema,
        response: {
          200: anchorActivateResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const currentUser = request.currentUser;
      if (!currentUser || currentUser.level === "anonymous") {
        recordAuthChallenge(app, "anchor_activate", "forbidden");
        reply.code(403);
        return { message: "Verification is required before anchor activation" };
      }

      // SECURITY (A4 P0-2): brute-force guard on invite-code guessing.
      // Seed fixtures previously used guessable codes like
      // `WEAVE-ANCHOR-11735` (community zip as suffix); even after the
      // fixture entropy upgrade, this per-user bucket is defence-in-depth
      // so a compromised access token can't grind through a candidate
      // list at `/v1/auth/anchor/activate`.
      const rateDecision = await authAbuseStore.checkAnchorActivateAttempt(currentUser.userId);
      if (!rateDecision.allowed) {
        recordAuthChallenge(app, "anchor_activate", "rate_limited");
        reply
          .code(429)
          .header("retry-after", String(Math.max(rateDecision.retryAfterSeconds, 1)));
        return {
          message: `Too many anchor activation attempts. Retry in ${rateDecision.retryAfterSeconds}s.`
        };
      }

      const invite = await app.userStore.findAnchorInviteByCodeHash(hashAnchorInviteCode(request.body.invite_code));
      if (!invite) {
        recordAuthChallenge(app, "anchor_activate", "not_found");
        reply.code(404);
        return { message: "Anchor invite code is not valid" };
      }

      const existingAnchor = await app.userStore.getActiveAnchorByUser(currentUser.userId, invite.community.communityId);
      if (existingAnchor) {
        recordAuthChallenge(app, "anchor_activate", "rejected");
        reply.code(400);
        return { message: "Anchor is already activated for this community" };
      }

      const challengeId = randomUUID();
      const secret = generateTotpSecret();
      const recoveryCodes = generateRecoveryCodes();
      const challenge: StoredAnchorChallenge = {
        challengeId,
        kind: "anchor_activate",
        userId: currentUser.userId,
        communityId: invite.community.communityId,
        inviteId: invite.inviteId,
        secret,
        recoveryCodesHashes: recoveryCodes.map(hashRecoveryCode),
        expiresAt: Date.now() + anchorActivationChallengeTtlSeconds * 1000,
        attemptsRemaining: totpMaxAttempts
      };

      await app.refreshTokenStore.createAnchorActivationChallenge(challenge);
      recordAuthChallenge(app, "anchor_activate", "issued");
      return {
        activation_id: challengeId,
        community: {
          community_id: invite.community.communityId,
          name: invite.community.name,
          center_zip: invite.community.centerZip,
          join_policy: invite.community.joinPolicy
        },
        otpauth_uri: buildOtpAuthUri({
          issuer: "WeaveNYC Anchor",
          accountName: `${invite.orgName} (${currentUser.userId.slice(-6)})`,
          secret
        }),
        recovery_codes: recoveryCodes,
        expires_in_seconds: anchorActivationChallengeTtlSeconds
      };
    }
  );

  app.post<{ Body: AnchorActivateConfirmBody }>(
    "/v1/auth/anchor/activate/confirm",
    {
      schema: {
        summary: "Confirm anchor activation with a TOTP code",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: anchorActivateConfirmRequestSchema,
        response: {
          200: anonymousAuthResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const currentUser = request.currentUser;
      if (!currentUser || currentUser.level === "anonymous") {
        reply.code(403);
        return { message: "Verification is required before anchor activation" };
      }

      const challengeResult = await app.refreshTokenStore.verifyAnchorChallenge({
        challengeId: request.body.activation_id,
        kind: "anchor_activate",
        userId: currentUser.userId,
        code: request.body.totp_code,
        verifier: verifyTotpCode
      });

      if (challengeResult.status === "forbidden") {
        recordAuthChallenge(app, "anchor_activate_confirm", "forbidden");
        reply.code(403);
        return { message: "Anchor activation challenge does not belong to this user" };
      }

      if (challengeResult.status !== "verified") {
        recordAuthChallenge(
          app,
          "anchor_activate_confirm",
          challengeResult.status === "exhausted" ? "exhausted" : "rejected",
        );
        reply.code(400);
        return { message: "Anchor activation challenge is not valid" };
      }

      const activatedAt = new Date().toISOString();
      const user = await app.userStore.activateAnchor({
        userId: currentUser.userId,
        inviteId: challengeResult.challenge.inviteId ?? "",
        totpSecretCiphertext: encryptSecret(
          challengeResult.challenge.secret,
          app.config.anchorTotpEncryptionKey
        ),
        recoveryCodesHashes: challengeResult.challenge.recoveryCodesHashes ?? [],
        activatedAt
      });

      if (!user) {
        recordAuthChallenge(app, "anchor_activate_confirm", "not_found");
        reply.code(404);
        return { message: "Anchor invite is not valid" };
      }

      await app.refreshTokenStore.revokeUserSessions(currentUser.userId);
      await app.userStore.recordAnchorMfa({
        userId: currentUser.userId,
        communityId: challengeResult.challenge.communityId,
        occurredAt: activatedAt
      });
      recordAuthChallenge(app, "anchor_activate_confirm", "verified");

      await app.analyticsRecorder.recordEvent({
        event_type: "anchor_activated",
        community_id: challengeResult.challenge.communityId,
        actor_user_id: currentUser.userId,
        payload: {}
      });

      return issueSessionResponse(app, {
        ...user,
        anchorCommunityId: challengeResult.challenge.communityId,
        mfaVerifiedAt: activatedAt
      }, "anchor_activate");
    }
  );

  app.post<{ Body: AnchorSessionStartBody }>(
    "/v1/auth/anchor/session/start",
    {
      schema: {
        summary: "Start a TOTP step-up challenge for an existing anchor",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: anchorSessionStartRequestSchema,
        response: {
          200: anchorSessionStartResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const currentUser = request.currentUser;
      if (!currentUser || currentUser.level === "anonymous") {
        recordAuthChallenge(app, "anchor_session_start", "forbidden");
        reply.code(403);
        return { message: "Verification is required before opening an anchor session" };
      }

      const anchor = await app.userStore.getActiveAnchorByUser(currentUser.userId, request.body.community_id);
      if (!anchor?.totpSecretCiphertext) {
        recordAuthChallenge(app, "anchor_session_start", "not_found");
        reply.code(404);
        return { message: "Anchor account not found for this community" };
      }

      const challengeId = randomUUID();
      await app.refreshTokenStore.createAnchorSessionChallenge({
        challengeId,
        kind: "anchor_session",
        userId: currentUser.userId,
        communityId: request.body.community_id,
        secret: decryptSecret(anchor.totpSecretCiphertext, app.config.anchorTotpEncryptionKey),
        expiresAt: Date.now() + anchorSessionChallengeTtlSeconds * 1000,
        attemptsRemaining: totpMaxAttempts
      });
      recordAuthChallenge(app, "anchor_session_start", "issued");

      return {
        challenge_id: challengeId,
        expires_in_seconds: anchorSessionChallengeTtlSeconds
      };
    }
  );

  app.post<{ Body: AnchorSessionVerifyBody }>(
    "/v1/auth/anchor/session/verify",
    {
      schema: {
        summary: "Verify a TOTP step-up challenge and mint an anchor session",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: anchorSessionVerifyRequestSchema,
        response: {
          200: anonymousAuthResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const currentUser = request.currentUser;
      if (!currentUser || currentUser.level === "anonymous") {
        recordAuthChallenge(app, "anchor_session_verify", "forbidden");
        reply.code(403);
        return { message: "Verification is required before opening an anchor session" };
      }

      const challengeResult = await app.refreshTokenStore.verifyAnchorChallenge({
        challengeId: request.body.challenge_id,
        kind: "anchor_session",
        userId: currentUser.userId,
        code: request.body.totp_code,
        verifier: verifyTotpCode
      });

      if (challengeResult.status === "forbidden") {
        recordAuthChallenge(app, "anchor_session_verify", "forbidden");
        reply.code(403);
        return { message: "Anchor session challenge does not belong to this user" };
      }

      if (challengeResult.status !== "verified") {
        recordAuthChallenge(
          app,
          "anchor_session_verify",
          challengeResult.status === "exhausted" ? "exhausted" : "rejected",
        );
        reply.code(400);
        return { message: "Anchor session challenge is not valid" };
      }

      const user = await app.userStore.getAuthUserById(currentUser.userId);
      if (!user) {
        recordAuthChallenge(app, "anchor_session_verify", "not_found");
        reply.code(404);
        return { message: "User not found" };
      }

      const occurredAt = new Date().toISOString();
      await app.refreshTokenStore.revokeUserSessions(currentUser.userId);
      await app.userStore.recordAnchorMfa({
        userId: currentUser.userId,
        communityId: challengeResult.challenge.communityId,
        occurredAt
      });
      recordAuthChallenge(app, "anchor_session_verify", "verified");

      return issueSessionResponse(app, {
        ...user,
        role: "anchor",
        level: "anchor",
        anchorCommunityId: challengeResult.challenge.communityId,
        mfaVerifiedAt: occurredAt
      }, "anchor_session");
    }
  );

  app.post<{
    Body: { community_id: string; recovery_code: string };
  }>(
    "/v1/auth/anchor/session/recovery",
    {
      schema: {
        summary: "Open an anchor session using a one-time recovery code (TOTP fallback)",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: anchorSessionRecoveryRequestSchema,
        response: {
          200: anchorSessionRecoveryResponseSchema,
          400: anchorSessionRecoveryErrorResponseSchema,
          403: errorResponseSchema,
          404: anchorSessionRecoveryErrorResponseSchema,
          429: anchorSessionRecoveryErrorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const currentUser = request.currentUser;
      if (!currentUser || currentUser.level === "anonymous") {
        recordAuthChallenge(app, "anchor_session_recovery", "forbidden");
        reply.code(403);
        return { message: "Verification is required before opening an anchor session" };
      }

      const rateDecision = await authAbuseStore.checkAnchorRecoveryAttempt(currentUser.userId);
      if (!rateDecision.allowed) {
        recordAuthChallenge(app, "anchor_session_recovery", "rate_limited");
        reply.code(429);
        reply.header("retry-after", String(Math.max(rateDecision.retryAfterSeconds, 1)));
        return {
          message: `Too many anchor recovery attempts. Retry in ${rateDecision.retryAfterSeconds}s.`,
          remaining_attempts: 0
        };
      }

      const anchor = await app.userStore.getActiveAnchorByUser(currentUser.userId, request.body.community_id);
      if (!anchor) {
        recordAuthChallenge(app, "anchor_session_recovery", "not_found");
        reply.code(404);
        return {
          message: "Anchor account not found for this community",
          remaining_attempts: rateDecision.remaining
        };
      }

      const codeHash = hashRecoveryCode(request.body.recovery_code);
      const consumed = await app.userStore.consumeAnchorRecoveryCode({
        userId: currentUser.userId,
        communityId: request.body.community_id,
        codeHash
      });

      if (!consumed) {
        recordAuthChallenge(app, "anchor_session_recovery", "rejected");
        reply.code(400);
        return {
          message: "Recovery code is invalid or already used",
          remaining_attempts: rateDecision.remaining
        };
      }

      const user = await app.userStore.getAuthUserById(currentUser.userId);
      if (!user) {
        recordAuthChallenge(app, "anchor_session_recovery", "not_found");
        reply.code(404);
        return {
          message: "User not found",
          remaining_attempts: rateDecision.remaining
        };
      }

      const occurredAt = new Date().toISOString();
      await app.refreshTokenStore.revokeUserSessions(currentUser.userId);
      await app.userStore.recordAnchorMfa({
        userId: currentUser.userId,
        communityId: request.body.community_id,
        occurredAt
      });
      recordAuthChallenge(app, "anchor_session_recovery", "verified");

      const sessionResponse = await issueSessionResponse(app, {
        ...user,
        role: "anchor",
        level: "anchor",
        anchorCommunityId: request.body.community_id,
        mfaVerifiedAt: occurredAt
      }, "anchor_session");

      return {
        ...sessionResponse,
        remaining_attempts: rateDecision.remaining
      };
    }
  );

  // Server-side logout (A1 P1-7). Previously sign-out was client-only,
  // so a stolen refresh token stayed valid for up to 7 days after the
  // user hit "Clear this device". Now the client POSTs here first and
  // we revoke the user's session families in Redis. `revoke_all_devices`
  // controls scope: false (default) revokes just the caller's family,
  // true revokes every family belonging to `userId` (used by the
  // "Clear all devices" action in Settings and admin-shell).
  //
  // Best-effort on the client side — if the POST fails (offline, gateway
  // down), the client still clears local state so the UX is never stuck.
  app.post<{ Body: LogoutBody }>(
    "/v1/auth/logout",
    {
      schema: {
        summary: "Revoke the caller's refresh session(s) server-side",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            revoke_all_devices: { type: "boolean" }
          }
        },
        response: {
          204: { type: "null" },
          401: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      // `request.user.sub` is the authenticated user's id (the access
      // token has already been verified by `app.authenticate`). For the
      // narrow "just this device" case we would prefer to revoke only
      // the caller's current refresh-token family, but JWT claims do
      // not yet carry `refresh_token_family_id`. Until that lands we
      // revoke EVERY family for this user; this is strictly safer than
      // the previous behaviour (no revocation at all) and still unblocks
      // the "Clear all devices" surface.
      const userId = request.user.sub;
      await app.refreshTokenStore.revokeUserSessions(userId);
      reply.code(204);
      return null;
    }
  );
};

function getAuthAbuseStore(app: FastifyInstance): AuthAbuseStore {
  return (app as FastifyInstance & { authAbuseStore: AuthAbuseStore }).authAbuseStore;
}

async function issueSessionResponse(
  app: FastifyInstance,
  user: AuthenticatedUserRecord,
  issuedVia: "anonymous" | "otp" | "magic_link" | "refresh" | "anchor_activate" | "anchor_session",
  fallback?: boolean
) {
  const refreshToken = createOpaqueRefreshToken();
  const now = new Date().toISOString();
  await app.refreshTokenStore.createSession(
    refreshToken,
    buildStoredRefreshSession({
      userId: user.userId,
      level: user.level,
      role: user.role,
      communityIds: user.communityIds,
      anchorCommunityId: user.anchorCommunityId ?? null,
      mfaVerifiedAt: user.mfaVerifiedAt,
      lastActivityAt: user.level === "anchor" ? now : undefined
    })
  );

  return {
    access_token: signAccessToken(app, user),
    refresh_token: refreshToken,
    issued_via: issuedVia,
    fallback,
    user: {
      user_id: user.userId,
      level: user.level
    }
  };
}

function buildRefreshSessionUser(
  currentUser: AuthenticatedUserRecord,
  storedSession: ReturnType<typeof buildStoredRefreshSession>,
): AuthenticatedUserRecord | null {
  if (storedSession.level === "anchor") {
    if (
      !storedSession.mfaVerifiedAt ||
      !currentUser.anchorCommunityId ||
      currentUser.anchorCommunityId !== storedSession.anchorCommunityId
    ) {
      return null;
    }

    return {
      ...currentUser,
      level: "anchor",
      role: "anchor",
      anchorCommunityId: currentUser.anchorCommunityId,
      mfaVerifiedAt: storedSession.mfaVerifiedAt,
    };
  }

  return {
    ...currentUser,
    level: storedSession.level,
    role: storedSession.role,
    anchorCommunityId: null,
    mfaVerifiedAt: undefined,
  };
}

function hashAnchorInviteCode(inviteCode: string) {
  return createHash("sha256").update(inviteCode.trim().toUpperCase()).digest("hex");
}

function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}
