import { createHash, randomUUID } from "node:crypto";

import { Redis } from "ioredis";

import type { StoredRefreshSession } from "../types.js";

type ChallengeKind = "otp" | "magic_link";

export interface StoredIdentityChallenge {
  challengeId: string;
  kind: ChallengeKind;
  userId: string;
  identityHash: string;
  identitySalt: string;
  abuseHash: string | null;
  maskedDestination: string;
  codeOrToken: string;
  attemptsRemaining: number;
  expiresAt: number;
}

export type RotateRefreshResult =
  | {
      status: "rotated";
      session: StoredRefreshSession;
    }
  | {
      status: "missing" | "revoked" | "replayed";
      familyId?: string;
      userId?: string;
    };

export interface RefreshTokenStore {
  ping(): Promise<void>;
  createSession(token: string, session: StoredRefreshSession): Promise<void>;
  inspectSession(token: string): Promise<
    | {
        status: "active";
        session: StoredRefreshSession;
      }
    | {
        status: "missing" | "revoked" | "replayed";
        familyId?: string;
        userId?: string;
      }
  >;
  rotateSession(currentToken: string, nextToken: string): Promise<RotateRefreshResult>;
  revokeUserSessions(userId: string): Promise<void>;
  createOtpChallenge(challenge: StoredIdentityChallenge): Promise<void>;
  createMagicLinkChallenge(challenge: StoredIdentityChallenge): Promise<void>;
  verifyChallenge(input: {
    challengeId: string;
    kind: ChallengeKind;
    codeOrToken: string;
  }): Promise<
    | {
        status: "verified";
        challenge: StoredIdentityChallenge;
      }
    | {
        status: "missing" | "expired" | "invalid";
      }
    | {
        status: "exhausted";
        challenge: StoredIdentityChallenge;
      }
  >;
  close(): Promise<void>;
}

export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number
  ) {}

  async ping(): Promise<void> {
    const pong = await this.redis.ping();
    if (pong !== "PONG") {
      throw new Error(`Unexpected Redis ping response: ${pong}`);
    }
  }

  async createSession(token: string, session: StoredRefreshSession): Promise<void> {
    await this.persistRefreshSession(token, session);
  }

  async inspectSession(token: string): Promise<
    | {
        status: "active";
        session: StoredRefreshSession;
      }
    | {
        status: "missing" | "revoked" | "replayed";
        familyId?: string;
        userId?: string;
      }
  > {
    return this.lookupSession(token);
  }

  async rotateSession(currentToken: string, nextToken: string): Promise<RotateRefreshResult> {
    const inspection = await this.lookupSession(currentToken);
    if (inspection.status !== "active") {
      if (inspection.status === "replayed" && inspection.familyId) {
        await this.revokeFamily(inspection.familyId);
      }

      return inspection;
    }

    const session = inspection.session;
    const currentKey = this.refreshSessionKey(currentToken);

    await this.redis.multi()
      .del(currentKey)
      .set(
        this.replayMarkerKey(currentToken),
        JSON.stringify({
          familyId: session.familyId,
          userId: session.userId
        }),
        "EX",
        this.ttlSeconds
      )
      .exec();

    await this.persistRefreshSession(nextToken, session);

    return {
      status: "rotated",
      session
    };
  }

  async revokeUserSessions(userId: string): Promise<void> {
    const familyIds = await this.redis.smembers(this.userFamiliesKey(userId));
    if (familyIds.length === 0) {
      return;
    }

    const tx = this.redis.multi();
    for (const familyId of familyIds) {
      tx.set(this.familyRevokedKey(familyId), "1", "EX", this.ttlSeconds);
    }
    await tx.exec();
  }

  async createOtpChallenge(challenge: StoredIdentityChallenge): Promise<void> {
    await this.persistChallenge(challenge);
  }

  async createMagicLinkChallenge(challenge: StoredIdentityChallenge): Promise<void> {
    await this.persistChallenge(challenge);
  }

  async verifyChallenge(input: {
    challengeId: string;
    kind: ChallengeKind;
    codeOrToken: string;
  }): Promise<
    | {
        status: "verified";
        challenge: StoredIdentityChallenge;
      }
    | {
        status: "missing" | "expired" | "invalid";
      }
    | {
        status: "exhausted";
        challenge: StoredIdentityChallenge;
      }
  > {
    const key = this.challengeKey(input.kind, input.challengeId);
    const raw = await this.redis.get(key);

    if (!raw) {
      return {
        status: "missing"
      };
    }

    const challenge = JSON.parse(raw) as StoredIdentityChallenge;
    if (challenge.expiresAt <= Date.now()) {
      await this.redis.del(key);
      return {
        status: "expired"
      };
    }

    if (challenge.codeOrToken !== input.codeOrToken) {
      const nextAttempts = challenge.attemptsRemaining - 1;
      if (nextAttempts <= 0) {
        await this.redis.del(key);
        return {
          status: "exhausted",
          challenge
        };
      }

      challenge.attemptsRemaining = nextAttempts;
      await this.redis.set(key, JSON.stringify(challenge), "KEEPTTL");
      return {
        status: "invalid"
      };
    }

    await this.redis.del(key);
    return {
      status: "verified",
      challenge
    };
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  private async persistRefreshSession(token: string, session: StoredRefreshSession) {
    await this.redis.multi()
      .set(this.refreshSessionKey(token), JSON.stringify(session), "EX", this.ttlSeconds)
      .sadd(this.userFamiliesKey(session.userId), session.familyId)
      .expire(this.userFamiliesKey(session.userId), this.ttlSeconds)
      .exec();
  }

  private async persistChallenge(challenge: StoredIdentityChallenge) {
    const ttlSeconds = Math.max(1, Math.ceil((challenge.expiresAt - Date.now()) / 1000));
    await this.redis.set(
      this.challengeKey(challenge.kind, challenge.challengeId),
      JSON.stringify(challenge),
      "EX",
      ttlSeconds
    );
  }

  private async lookupReplayMarker(token: string): Promise<{
    familyId: string;
    userId: string;
  } | null> {
    const raw = await this.redis.get(this.replayMarkerKey(token));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as {
      familyId: string;
      userId: string;
    };
  }

  private async revokeFamily(familyId: string) {
    await this.redis.set(this.familyRevokedKey(familyId), "1", "EX", this.ttlSeconds);
  }

  private async lookupSession(token: string): Promise<
    | {
        status: "active";
        session: StoredRefreshSession;
      }
    | {
        status: "missing" | "revoked" | "replayed";
        familyId?: string;
        userId?: string;
      }
  > {
    const currentKey = this.refreshSessionKey(token);
    const raw = await this.redis.get(currentKey);

    if (!raw) {
      const replay = await this.lookupReplayMarker(token);
      if (replay) {
        return {
          status: "replayed",
          familyId: replay.familyId,
          userId: replay.userId
        };
      }

      return {
        status: "missing"
      };
    }

    const session = JSON.parse(raw) as StoredRefreshSession;
    const revoked = await this.redis.get(this.familyRevokedKey(session.familyId));
    if (revoked === "1") {
      await this.redis.del(currentKey);
      return {
        status: "revoked",
        familyId: session.familyId,
        userId: session.userId
      };
    }

    return {
      status: "active",
      session
    };
  }

  private refreshSessionKey(token: string): string {
    return `refresh:session:${tokenHash(token)}`;
  }

  private replayMarkerKey(token: string): string {
    return `refresh:used:${tokenHash(token)}`;
  }

  private familyRevokedKey(familyId: string): string {
    return `refresh:family:${familyId}:revoked`;
  }

  private userFamiliesKey(userId: string): string {
    return `refresh:user:${userId}:families`;
  }

  private challengeKey(kind: ChallengeKind, challengeId: string): string {
    return `verify:${kind}:${challengeId}`;
  }
}

export function createRedisRefreshTokenStore(
  redisUrl: string,
  ttlSeconds: number
): RedisRefreshTokenStore {
  return new RedisRefreshTokenStore(
    new Redis(redisUrl, {
      maxRetriesPerRequest: 1
    }),
    ttlSeconds
  );
}

export function buildStoredRefreshSession(input: {
  userId: string;
  level: StoredRefreshSession["level"];
  role: StoredRefreshSession["role"];
  communityIds: string[];
  familyId?: string;
}): StoredRefreshSession {
  return {
    userId: input.userId,
    level: input.level,
    role: input.role,
    communityIds: input.communityIds,
    familyId: input.familyId ?? randomUUID()
  };
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
