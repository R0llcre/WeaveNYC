import { describe, expect, it } from 'vitest';

import {
  accountDeleteBurstLimit,
  accountDeleteWindowSeconds,
  recoveryCodeBurstLimit,
  recoveryCodeWindowSeconds,
} from '@weavenyc/shared';

import { RedisAuthAbuseStore } from '../src/lib/identity.js';

import { InMemoryAuthAbuseStore } from './helpers.js';

/**
 * Minimal in-memory Redis fake covering the commands the RedisAuthAbuseStore
 * token-bucket implementation actually uses: incr, expire, ttl, set, quit.
 * Commands that are not exercised by RedisAuthAbuseStore throw to surface
 * drift if the implementation ever reaches for something new.
 */
class FakeRedis {
  private values = new Map<string, number>();
  private ttls = new Map<string, number>();

  async incr(key: string): Promise<number> {
    const next = (this.values.get(key) ?? 0) + 1;
    this.values.set(key, next);
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.values.has(key)) {
      return 0;
    }
    this.ttls.set(key, seconds);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    if (!this.values.has(key)) {
      return -2;
    }
    return this.ttls.get(key) ?? -1;
  }

  async set(key: string, value: string, _exFlag: 'EX', seconds: number): Promise<'OK'> {
    this.values.set(key, Number(value));
    this.ttls.set(key, seconds);
    return 'OK';
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }
}

function createRedisStore() {
  const fake = new FakeRedis();
  // RedisAuthAbuseStore only touches the ioredis methods implemented above.
  const store = new RedisAuthAbuseStore(fake as unknown as import('ioredis').Redis, 'test-pepper');
  return { store, fake };
}

describe('InMemoryAuthAbuseStore.checkAccountDeleteRequest', () => {
  it('allows the first 3 requests and blocks the 4th', async () => {
    const store = new InMemoryAuthAbuseStore();
    const userId = 'user-A';

    const decisions = [];
    for (let i = 0; i < accountDeleteBurstLimit; i += 1) {
      decisions.push(await store.checkAccountDeleteRequest(userId));
    }

    expect(decisions).toHaveLength(3);
    for (const decision of decisions) {
      expect(decision.allowed).toBe(true);
      expect(decision.retryAfterSeconds).toBe(0);
    }
    expect(decisions[0].remaining).toBe(2);
    expect(decisions[1].remaining).toBe(1);
    expect(decisions[2].remaining).toBe(0);

    const blocked = await store.checkAccountDeleteRequest(userId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(accountDeleteWindowSeconds);
    expect(blocked.remaining).toBe(0);
    expect(store.seenAccountDeleteKeys.filter((key) => key === userId)).toHaveLength(4);
  });

  it('tracks windows independently per userId', async () => {
    const store = new InMemoryAuthAbuseStore();

    for (let i = 0; i < accountDeleteBurstLimit; i += 1) {
      await store.checkAccountDeleteRequest('user-A');
    }
    const userABlocked = await store.checkAccountDeleteRequest('user-A');
    expect(userABlocked.allowed).toBe(false);

    const userBFirst = await store.checkAccountDeleteRequest('user-B');
    expect(userBFirst.allowed).toBe(true);
    expect(userBFirst.remaining).toBe(accountDeleteBurstLimit - 1);
  });

  it('honors per-test overrides via accountDeleteDecisions', async () => {
    const store = new InMemoryAuthAbuseStore();
    store.accountDeleteDecisions.set('user-A', {
      allowed: false,
      retryAfterSeconds: 1234,
      remaining: 0,
    });

    const decision = await store.checkAccountDeleteRequest('user-A');
    expect(decision).toEqual({ allowed: false, retryAfterSeconds: 1234, remaining: 0 });
  });
});

describe('InMemoryAuthAbuseStore.checkAnchorRecoveryAttempt', () => {
  it('allows the first 5 attempts and blocks the 6th', async () => {
    const store = new InMemoryAuthAbuseStore();
    const userId = 'anchor-A';

    const decisions = [];
    for (let i = 0; i < recoveryCodeBurstLimit; i += 1) {
      decisions.push(await store.checkAnchorRecoveryAttempt(userId));
    }

    expect(decisions).toHaveLength(5);
    for (const decision of decisions) {
      expect(decision.allowed).toBe(true);
      expect(decision.retryAfterSeconds).toBe(0);
    }
    expect(decisions[4].remaining).toBe(0);

    const blocked = await store.checkAnchorRecoveryAttempt(userId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(recoveryCodeWindowSeconds);
    expect(blocked.remaining).toBe(0);
    expect(store.seenRecoveryKeys.filter((key) => key === userId)).toHaveLength(6);
  });

  it('tracks windows independently per userId', async () => {
    const store = new InMemoryAuthAbuseStore();

    for (let i = 0; i < recoveryCodeBurstLimit; i += 1) {
      await store.checkAnchorRecoveryAttempt('anchor-A');
    }
    const anchorABlocked = await store.checkAnchorRecoveryAttempt('anchor-A');
    expect(anchorABlocked.allowed).toBe(false);

    const anchorBFirst = await store.checkAnchorRecoveryAttempt('anchor-B');
    expect(anchorBFirst.allowed).toBe(true);
    expect(anchorBFirst.remaining).toBe(recoveryCodeBurstLimit - 1);
  });

  it('honors per-test overrides via recoveryCodeDecisions', async () => {
    const store = new InMemoryAuthAbuseStore();
    store.recoveryCodeDecisions.set('anchor-A', {
      allowed: false,
      retryAfterSeconds: 42,
      remaining: 0,
    });

    const decision = await store.checkAnchorRecoveryAttempt('anchor-A');
    expect(decision).toEqual({ allowed: false, retryAfterSeconds: 42, remaining: 0 });
  });
});

describe('RedisAuthAbuseStore.checkAccountDeleteRequest', () => {
  it('allows the first 3 requests and blocks the 4th', async () => {
    const { store, fake } = createRedisStore();
    const userId = 'user-A';

    const decisions = [];
    for (let i = 0; i < accountDeleteBurstLimit; i += 1) {
      decisions.push(await store.checkAccountDeleteRequest(userId));
    }

    expect(decisions).toHaveLength(3);
    for (const decision of decisions) {
      expect(decision.allowed).toBe(true);
    }
    expect(decisions[0].remaining).toBe(2);
    expect(decisions[2].remaining).toBe(0);

    const blocked = await store.checkAccountDeleteRequest(userId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.remaining).toBe(0);

    // Confirm the rate-limit key picked up the configured window.
    expect(await fake.ttl(`auth-abuse:limit:account-delete:${userId}`)).toBe(
      accountDeleteWindowSeconds,
    );
  });

  it('tracks windows independently per userId', async () => {
    const { store } = createRedisStore();

    for (let i = 0; i < accountDeleteBurstLimit; i += 1) {
      await store.checkAccountDeleteRequest('user-A');
    }
    const userABlocked = await store.checkAccountDeleteRequest('user-A');
    expect(userABlocked.allowed).toBe(false);

    const userBFirst = await store.checkAccountDeleteRequest('user-B');
    expect(userBFirst.allowed).toBe(true);
    expect(userBFirst.remaining).toBe(accountDeleteBurstLimit - 1);
  });
});

describe('RedisAuthAbuseStore.checkAnchorRecoveryAttempt', () => {
  it('allows the first 5 attempts and blocks the 6th', async () => {
    const { store, fake } = createRedisStore();
    const userId = 'anchor-A';

    for (let i = 0; i < recoveryCodeBurstLimit; i += 1) {
      const decision = await store.checkAnchorRecoveryAttempt(userId);
      expect(decision.allowed).toBe(true);
    }

    const blocked = await store.checkAnchorRecoveryAttempt(userId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.remaining).toBe(0);

    expect(await fake.ttl(`auth-abuse:limit:recovery-code:${userId}`)).toBe(
      recoveryCodeWindowSeconds,
    );
  });

  it('tracks windows independently per userId', async () => {
    const { store } = createRedisStore();

    for (let i = 0; i < recoveryCodeBurstLimit; i += 1) {
      await store.checkAnchorRecoveryAttempt('anchor-A');
    }
    const anchorABlocked = await store.checkAnchorRecoveryAttempt('anchor-A');
    expect(anchorABlocked.allowed).toBe(false);

    const anchorBFirst = await store.checkAnchorRecoveryAttempt('anchor-B');
    expect(anchorBFirst.allowed).toBe(true);
    expect(anchorBFirst.remaining).toBe(recoveryCodeBurstLimit - 1);
  });
});
