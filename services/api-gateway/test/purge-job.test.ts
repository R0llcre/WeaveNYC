import { describe, expect, it, vi } from 'vitest';

import type { Pool } from 'pg';

import { createPurgeJob } from '../src/lib/purge-job.js';

/**
 * Minimal Pool/Client fake. Our purge-job only uses `pool.connect()` plus the
 * client methods `query(sql, params?)` and `release()`. We capture every SQL
 * statement so tests can assert cascade order without needing a real database.
 *
 * Rows returned for SELECTs are driven by an `onSelect` callback supplied by
 * each test; everything else (DELETE/UPDATE/BEGIN/COMMIT/ROLLBACK/INSERT)
 * returns an empty result set.
 */
interface CapturedQuery {
  sql: string;
  params: unknown[];
}

function createPoolFake(options: {
  onSelect?: (sql: string, params: unknown[]) => Array<Record<string, unknown>>;
} = {}) {
  const captured: CapturedQuery[] = [];
  let released = false;

  const client = {
    async query(sql: string, params: unknown[] = []): Promise<{
      rows: Array<Record<string, unknown>>;
      rowCount: number;
    }> {
      const normalized = sql.trim().toLowerCase();
      captured.push({ sql: normalized, params });

      if (normalized.startsWith('select')) {
        const rows = options.onSelect?.(normalized, params) ?? [];
        return { rows, rowCount: rows.length };
      }

      if (
        normalized.startsWith('delete from users') &&
        normalized.includes('returning user_id')
      ) {
        // Simulate the final user-row delete returning the row we purged.
        return { rows: [{ user_id: params[0] }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
    release() {
      released = true;
    },
  };

  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;

  return {
    pool,
    captured,
    get released() {
      return released;
    },
  };
}

describe('createPurgeJob', () => {
  it('rejects invalid cron expressions', () => {
    const { pool } = createPoolFake();
    expect(() =>
      createPurgeJob({ pool, enabled: true, schedule: 'definitely not cron' }),
    ).toThrow(/Invalid cron schedule/);
  });

  it('uses the default daily UTC schedule when none is provided', () => {
    const { pool } = createPoolFake();
    const job = createPurgeJob({ pool, enabled: false });
    // Job object is created without throwing; default schedule ("0 0 * * *") is valid.
    expect(job).toBeDefined();
  });

  it('runOnce returns 0 when no users are due for purge', async () => {
    const { pool, captured } = createPoolFake({
      onSelect: () => [],
    });
    const job = createPurgeJob({ pool, enabled: false });

    const result = await job.runOnce();
    expect(result).toEqual({ deletedUsers: 0 });
    // Only the initial candidate-select runs; no transaction is opened.
    expect(captured.some((entry) => entry.sql.startsWith('begin'))).toBe(false);
    expect(captured.some((entry) => entry.sql.startsWith('commit'))).toBe(false);
  });

  it('runOnce cascades deletes, records analytics, and commits per user', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const deletedAt = new Date(Date.now() - 31 * 86_400_000); // 31 days ago
    const purgeAt = new Date(Date.now() - 1 * 86_400_000); // yesterday

    let candidateCallCount = 0;
    const { pool, captured } = createPoolFake({
      onSelect: (sql) => {
        if (
          sql.startsWith('select user_id, deleted_at, purge_at') ||
          sql.includes('from users\n      where status')
        ) {
          candidateCallCount += 1;
          if (candidateCallCount === 1) {
            return [{ user_id: userId, deleted_at: deletedAt, purge_at: purgeAt }];
          }
          return [];
        }
        return [];
      },
    });

    const job = createPurgeJob({ pool, enabled: false, actorHashPepper: 'test-pepper' });
    const result = await job.runOnce();

    expect(result).toEqual({ deletedUsers: 1 });

    const sequence = captured.map((entry) => entry.sql);

    // Transaction lifecycle present for the single user
    expect(sequence.filter((sql) => sql === 'begin').length).toBe(1);
    expect(sequence.filter((sql) => sql === 'commit').length).toBe(1);
    expect(sequence.filter((sql) => sql === 'rollback').length).toBe(0);

    // Cascade order: messages -> conversation_reads -> blocks -> reports ->
    // conversations -> contact_requests -> match_suggestions -> posts ->
    // community_members -> anchors -> users -> analytics_events
    const ixMessages = sequence.findIndex((sql) => sql.includes('delete from messages'));
    const ixReads = sequence.findIndex((sql) => sql.includes('delete from conversation_reads'));
    const ixBlocks = sequence.findIndex((sql) => sql.includes('delete from blocks'));
    const ixReports = sequence.findIndex((sql) => sql.includes('delete from reports'));
    const ixConversations = sequence.findIndex((sql) => sql.includes('delete from conversations'));
    const ixContactRequests = sequence.findIndex((sql) =>
      sql.includes('delete from contact_requests'),
    );
    const ixMatchSuggestions = sequence.findIndex((sql) =>
      sql.includes('delete from match_suggestions'),
    );
    const ixPosts = sequence.findIndex(
      (sql) => sql.startsWith('delete from posts') || sql.includes('delete from posts\n'),
    );
    const ixCommunityMembers = sequence.findIndex((sql) =>
      sql.includes('delete from community_members'),
    );
    const ixAnchors = sequence.findIndex((sql) => sql.includes('delete from anchors'));
    const ixUsers = sequence.findIndex((sql) => sql.includes('delete from users'));
    const ixAnalytics = sequence.findIndex((sql) =>
      sql.includes('insert into analytics_events'),
    );

    expect(ixMessages).toBeGreaterThan(-1);
    expect(ixMessages).toBeLessThan(ixReads);
    expect(ixReads).toBeLessThan(ixBlocks);
    expect(ixBlocks).toBeLessThan(ixReports);
    expect(ixReports).toBeLessThan(ixConversations);
    expect(ixConversations).toBeLessThan(ixContactRequests);
    expect(ixContactRequests).toBeLessThan(ixMatchSuggestions);
    expect(ixMatchSuggestions).toBeLessThan(ixPosts);
    expect(ixPosts).toBeLessThan(ixCommunityMembers);
    expect(ixCommunityMembers).toBeLessThan(ixAnchors);
    expect(ixAnchors).toBeLessThan(ixUsers);
    expect(ixUsers).toBeLessThan(ixAnalytics);

    // Analytics payload includes days_since_delete and hashed actor id.
    const analyticsInsert = captured.find((entry) =>
      entry.sql.includes('insert into analytics_events'),
    );
    expect(analyticsInsert?.params[0]).toBe('account_purged');
    expect(typeof analyticsInsert?.params[1]).toBe('string');
    expect((analyticsInsert?.params[1] as string).length).toBe(64); // sha256 hex
    const payload = JSON.parse(analyticsInsert?.params[2] as string) as {
      days_since_delete: number;
    };
    expect(payload.days_since_delete).toBeGreaterThanOrEqual(30);
  });

  it('runOnce is idempotent when re-run with no new candidates', async () => {
    const { pool } = createPoolFake({ onSelect: () => [] });
    const job = createPurgeJob({ pool, enabled: false });

    const first = await job.runOnce();
    const second = await job.runOnce();
    expect(first).toEqual({ deletedUsers: 0 });
    expect(second).toEqual({ deletedUsers: 0 });
  });

  it('rolls back the transaction when a per-user query fails', async () => {
    const userId = '00000000-0000-4000-8000-000000000002';
    const deletedAt = new Date(Date.now() - 31 * 86_400_000);
    const purgeAt = new Date(Date.now() - 1 * 86_400_000);

    let candidateCalls = 0;
    const captured: CapturedQuery[] = [];

    const client = {
      async query(sql: string, params: unknown[] = []): Promise<{
        rows: Array<Record<string, unknown>>;
        rowCount: number;
      }> {
        const normalized = sql.trim().toLowerCase();
        captured.push({ sql: normalized, params });

        if (normalized.startsWith('select user_id, deleted_at, purge_at')) {
          candidateCalls += 1;
          if (candidateCalls === 1) {
            return {
              rows: [{ user_id: userId, deleted_at: deletedAt, purge_at: purgeAt }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }

        if (normalized.includes('delete from messages')) {
          throw new Error('simulated db failure');
        }

        return { rows: [], rowCount: 0 };
      },
      release() {},
    };
    const pool = {
      async connect() {
        return client;
      },
    } as unknown as Pool;

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      child() {
        return logger;
      },
      level: 'error',
      silent() {},
    } as unknown as Parameters<typeof createPurgeJob>[0]['logger'];

    const job = createPurgeJob({ pool, enabled: false, logger });
    const result = await job.runOnce();
    expect(result).toEqual({ deletedUsers: 0 });
    const sequence = captured.map((c) => c.sql);
    expect(sequence.filter((s) => s === 'begin').length).toBe(1);
    expect(sequence.filter((s) => s === 'rollback').length).toBe(1);
    expect(sequence.filter((s) => s === 'commit').length).toBe(0);
  });

  it('stop() completes without error even when cron never started', async () => {
    const { pool } = createPoolFake();
    const job = createPurgeJob({ pool, enabled: false });
    await expect(job.stop()).resolves.toBeUndefined();
  });

  it('start() is a no-op when the job is disabled', () => {
    const { pool } = createPoolFake();
    const job = createPurgeJob({ pool, enabled: false });
    expect(() => job.start()).not.toThrow();
  });

  it('start() then stop() cancels the scheduled cron cleanly', async () => {
    const { pool } = createPoolFake();
    // Use a schedule that only fires once per hour so the test run never
    // actually triggers an execution; we only verify start/stop plumbing.
    const job = createPurgeJob({ pool, enabled: true, schedule: '0 * * * *' });
    job.start();
    // start is idempotent
    job.start();
    await expect(job.stop()).resolves.toBeUndefined();
  });

  it(
    'runOnce scrubs community_sync_events payload_json + actor_p2p_id for ' +
      'post/announcement/report aggregates',
    async () => {
      const userId = '00000000-0000-4000-8000-000000000099';
      const deletedAt = new Date(Date.now() - 31 * 86_400_000);
      const purgeAt = new Date(Date.now() - 1 * 86_400_000);

      let candidateCalls = 0;
      const { pool, captured } = createPoolFake({
        onSelect: (sql) => {
          if (sql.startsWith('select user_id, deleted_at, purge_at')) {
            candidateCalls += 1;
            if (candidateCalls === 1) {
              return [{ user_id: userId, deleted_at: deletedAt, purge_at: purgeAt }];
            }
            return [];
          }
          return [];
        },
      });

      const job = createPurgeJob({ pool, enabled: false, actorHashPepper: 'test-pepper' });
      const result = await job.runOnce();
      expect(result).toEqual({ deletedUsers: 1 });

      // Find the payload tombstone + actor_p2p_id scrub statement.
      const tombstoneUpdate = captured.find(
        (entry) =>
          entry.sql.includes('update community_sync_events') &&
          entry.sql.includes("jsonb_build_object('tombstoned', true, 'reason', 'user_deleted')") &&
          entry.sql.includes('actor_p2p_id = null') &&
          entry.sql.includes("aggregate_type in ('post', 'announcement', 'report')"),
      );
      expect(tombstoneUpdate).toBeDefined();
      expect(tombstoneUpdate?.params[0]).toBe(userId);

      // The tombstone scrub must precede the separate fallback nulling of
      // actor_user_id so that the WHERE clause can still match actor_user_id = $1.
      const tombstoneIndex = captured.findIndex((entry) => entry === tombstoneUpdate);
      const actorNullIndex = captured.findIndex(
        (entry) =>
          entry.sql.includes('update community_sync_events') &&
          entry.sql.includes('set actor_user_id = null') &&
          !entry.sql.includes('tombstoned'),
      );
      expect(tombstoneIndex).toBeGreaterThan(-1);
      expect(actorNullIndex).toBeGreaterThan(-1);
      expect(tombstoneIndex).toBeLessThan(actorNullIndex);

      // Both writes sit inside the single per-user transaction.
      const beginIndex = captured.findIndex((entry) => entry.sql === 'begin');
      const commitIndex = captured.findIndex((entry) => entry.sql === 'commit');
      expect(beginIndex).toBeGreaterThan(-1);
      expect(commitIndex).toBeGreaterThan(-1);
      expect(beginIndex).toBeLessThan(tombstoneIndex);
      expect(tombstoneIndex).toBeLessThan(commitIndex);
    },
  );

  it('stop() waits for an in-flight runOnce to finish', async () => {
    let resolveInsideQuery: (() => void) | null = null;
    let sawCommit = false;
    const userId = '00000000-0000-4000-8000-000000000003';
    const deletedAt = new Date(Date.now() - 31 * 86_400_000);
    const purgeAt = new Date(Date.now() - 1 * 86_400_000);

    let selectCalls = 0;
    const client = {
      async query(sql: string) {
        const normalized = sql.trim().toLowerCase();
        if (normalized.startsWith('select user_id, deleted_at, purge_at')) {
          selectCalls += 1;
          if (selectCalls === 1) {
            return {
              rows: [{ user_id: userId, deleted_at: deletedAt, purge_at: purgeAt }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }
        if (normalized.includes('delete from messages')) {
          // pause the purge mid-transaction
          await new Promise<void>((resolve) => {
            resolveInsideQuery = resolve;
          });
        }
        if (normalized === 'commit') {
          sawCommit = true;
        }
        if (normalized.includes('delete from users')) {
          return { rows: [{ user_id: userId }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release() {},
    };
    const pool = {
      async connect() {
        return client;
      },
    } as unknown as Pool;

    const job = createPurgeJob({ pool, enabled: false });
    const runPromise = job.runOnce();

    // wait until the fake is blocked inside the delete from messages step
    const resumer = await new Promise<() => void>((resolve) => {
      const poll = () => {
        if (resolveInsideQuery) {
          resolve(resolveInsideQuery);
        } else {
          setImmediate(poll);
        }
      };
      poll();
    });

    const stopPromise = job.stop();
    // stop should not resolve before runOnce does
    let stopResolved = false;
    void stopPromise.then(() => {
      stopResolved = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(stopResolved).toBe(false);

    resumer();
    const result = await runPromise;
    await stopPromise;
    expect(result).toEqual({ deletedUsers: 1 });
    expect(sawCommit).toBe(true);
  });
});
