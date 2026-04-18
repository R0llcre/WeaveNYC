import { createHmac, randomBytes, randomInt } from "node:crypto";

import {
  accountDeleteBurstLimit,
  accountDeleteWindowSeconds,
  anonymousAuthBurstLimit,
  anonymousAuthWindowSeconds,
  otpCodeLength,
  otpCooldownSeconds,
  otpStartBurstLimit,
  otpStartWindowSeconds,
  recoveryCodeBurstLimit,
  recoveryCodeWindowSeconds,
  refreshAuthBurstLimit,
  refreshAuthWindowSeconds
} from "@weavenyc/shared";
import { Redis } from "ioredis";

export interface IdentityHashOptions {
  namespace: "phone" | "email" | "device" | "refresh" | "ip";
  salt: string;
  pepper: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export interface AuthAbuseStore {
  checkAnonymousAuth(ipAddress: string): Promise<RateLimitDecision>;
  checkRefreshAttempt(userId: string): Promise<RateLimitDecision>;
  checkOtpStart(userId: string, phoneHash: string): Promise<RateLimitDecision>;
  checkAccountDeleteRequest(userId: string): Promise<RateLimitDecision>;
  checkAnchorRecoveryAttempt(userId: string): Promise<RateLimitDecision>;
  activateOtpCooldown(phoneHash: string): Promise<void>;
  close(): Promise<void>;
}

export function normalizePhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (/^\+\d{10,15}$/.test(input.trim())) {
    return input.trim();
  }

  throw new Error("Phone number must be a valid US number");
}

export function normalizeEmail(input: string): string {
  const normalized = input.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Email must be valid");
  }

  return normalized;
}

export function generateIdentitySalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashIdentity(value: string, options: IdentityHashOptions): string {
  return createHmac("sha256", options.pepper)
    .update(`${options.namespace}:${options.salt}:${value}`)
    .digest("hex");
}

export function hashPhoneIdentity(normalizedPhone: string, salt: string, pepper: string): string {
  return hashIdentity(normalizedPhone, {
    namespace: "phone",
    salt,
    pepper
  });
}

export function hashEmailIdentity(normalizedEmail: string, salt: string, pepper: string): string {
  return hashIdentity(normalizedEmail, {
    namespace: "email",
    salt,
    pepper
  });
}

export function hashPhoneAbuseKey(normalizedPhone: string, pepper: string): string {
  return hashIdentity(normalizedPhone, {
    namespace: "phone",
    salt: "auth-abuse-phone",
    pepper
  });
}

export function maskPhoneNumber(normalizedPhone: string): string {
  const last4 = normalizedPhone.replace(/\D/g, "").slice(-4);
  return `***${last4}`;
}

export function maskEmailAddress(normalizedEmail: string): string {
  const [localPart, domain] = normalizedEmail.split("@");
  const maskedLocal = `${localPart.slice(0, 1)}***`;

  return `${maskedLocal}@${domain}`;
}

export function createOtpCode(): string {
  const max = 10 ** otpCodeLength;
  return randomInt(0, max).toString().padStart(otpCodeLength, "0");
}

export class RedisAuthAbuseStore implements AuthAbuseStore {
  constructor(
    private readonly redis: Redis,
    private readonly pepper: string
  ) {}

  async checkAnonymousAuth(ipAddress: string): Promise<RateLimitDecision> {
    return this.consumeRateLimit(
      ["anonymous", this.hashIpAddress(ipAddress)],
      anonymousAuthBurstLimit,
      anonymousAuthWindowSeconds
    );
  }

  async checkRefreshAttempt(userId: string): Promise<RateLimitDecision> {
    return this.consumeRateLimit(
      ["refresh", this.hashRefreshSubject(userId)],
      refreshAuthBurstLimit,
      refreshAuthWindowSeconds
    );
  }

  async checkOtpStart(userId: string, phoneHash: string): Promise<RateLimitDecision> {
    const cooldownKey = this.cooldownKey(phoneHash);
    const cooldownTtl = await this.redis.ttl(cooldownKey);
    if (cooldownTtl > 0) {
      return {
        allowed: false,
        retryAfterSeconds: cooldownTtl,
        remaining: 0
      };
    }

    const userDecision = await this.consumeRateLimit(
      ["otp-start-user", userId],
      otpStartBurstLimit,
      otpStartWindowSeconds
    );
    if (!userDecision.allowed) {
      return userDecision;
    }

    return this.consumeRateLimit(
      ["otp-start-phone", phoneHash],
      otpStartBurstLimit,
      otpStartWindowSeconds
    );
  }

  async checkAccountDeleteRequest(userId: string): Promise<RateLimitDecision> {
    return this.consumeRateLimit(
      ["account-delete", userId],
      accountDeleteBurstLimit,
      accountDeleteWindowSeconds
    );
  }

  async checkAnchorRecoveryAttempt(userId: string): Promise<RateLimitDecision> {
    return this.consumeRateLimit(
      ["recovery-code", userId],
      recoveryCodeBurstLimit,
      recoveryCodeWindowSeconds
    );
  }

  async activateOtpCooldown(phoneHash: string): Promise<void> {
    await this.redis.set(this.cooldownKey(phoneHash), "1", "EX", otpCooldownSeconds);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  private async consumeRateLimit(
    parts: string[],
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitDecision> {
    const key = this.buildKey("limit", parts);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    const ttl = await this.redis.ttl(key);
    if (count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(ttl, 1),
        remaining: 0
      };
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(limit - count, 0)
    };
  }

  private hashIpAddress(ipAddress: string): string {
    return hashIdentity(ipAddress, {
      namespace: "ip",
      salt: "anonymous-auth",
      pepper: this.pepper
    });
  }

  private hashRefreshSubject(userId: string): string {
    return hashIdentity(userId, {
      namespace: "refresh",
      salt: "refresh-user",
      pepper: this.pepper
    });
  }

  private cooldownKey(phoneHash: string): string {
    return this.buildKey("cooldown", ["otp-phone", phoneHash]);
  }

  private buildKey(prefix: string, parts: string[]): string {
    return ["auth-abuse", prefix, ...parts].join(":");
  }
}

export function createRedisAuthAbuseStore(redisUrl: string, pepper: string): AuthAbuseStore {
  return new RedisAuthAbuseStore(
    new Redis(redisUrl, {
      maxRetriesPerRequest: 1
    }),
    pepper
  );
}

export async function clearRedisAuthAbuseKeys(redisUrl: string): Promise<void> {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1
  });

  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "auth-abuse:*", "COUNT", 100);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      cursor = nextCursor;
    } while (cursor !== "0");
  } finally {
    await redis.quit();
  }
}
