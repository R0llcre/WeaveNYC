import { describe, expect, it } from 'vitest';

import {
  buildCompositeKey,
  DEFAULT_IDEMPOTENCY_TTL_SECONDS,
  InMemoryIdempotencyStore,
  PgIdempotencyStore,
  readIdempotencyKey,
} from '../src/lib/idempotency.js';

describe('readIdempotencyKey', () => {
  it('extracts the header by lowercased name and trims whitespace', () => {
    const key = readIdempotencyKey({
      headers: { 'idempotency-key': '   post-tap-1   ' },
    } as unknown as Parameters<typeof readIdempotencyKey>[0]);
    expect(key).toBe('post-tap-1');
  });

  it('returns null for missing, empty, or non-string headers', () => {
    expect(
      readIdempotencyKey({
        headers: {},
      } as unknown as Parameters<typeof readIdempotencyKey>[0]),
    ).toBeNull();
    expect(
      readIdempotencyKey({
        headers: { 'idempotency-key': '   ' },
      } as unknown as Parameters<typeof readIdempotencyKey>[0]),
    ).toBeNull();
    expect(
      readIdempotencyKey({
        headers: { 'idempotency-key': undefined },
      } as unknown as Parameters<typeof readIdempotencyKey>[0]),
    ).toBeNull();
  });

  it('rejects pathologically long keys', () => {
    const tooLong = 'a'.repeat(300);
    const key = readIdempotencyKey({
      headers: { 'idempotency-key': tooLong },
    } as unknown as Parameters<typeof readIdempotencyKey>[0]);
    expect(key).toBeNull();
  });
});

describe('buildCompositeKey', () => {
  it('mixes userId, route, and clientKey so one user cannot hijack another', () => {
    const aliceKey = buildCompositeKey({
      userId: 'alice',
      routeName: 'posts.create',
      clientKey: 'abc',
    });
    const bobKey = buildCompositeKey({
      userId: 'bob',
      routeName: 'posts.create',
      clientKey: 'abc',
    });
    expect(aliceKey).not.toBe(bobKey);
    expect(aliceKey).toBe('alice:posts.create:abc');
  });
});

describe('InMemoryIdempotencyStore', () => {
  it('round-trips an insert + lookup', async () => {
    const store = new InMemoryIdempotencyStore();
    const expiresAt = new Date(Date.now() + DEFAULT_IDEMPOTENCY_TTL_SECONDS * 1000).toISOString();
    const insertion = await store.insertIfAbsent({
      key: 'u1:posts.create:k',
      routeName: 'posts.create',
      userId: 'u1',
      clientKey: 'k',
      statusCode: 200,
      body: { post_id: 'p1' },
      expiresAt,
    });
    expect(insertion).toBe('inserted');

    const replay = await store.lookup('u1:posts.create:k');
    expect(replay).toEqual({ statusCode: 200, body: { post_id: 'p1' } });
  });

  it('returns "conflict" on a second insert with the same key', async () => {
    const store = new InMemoryIdempotencyStore();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    await store.insertIfAbsent({
      key: 'u1:r:k',
      routeName: 'r',
      userId: 'u1',
      clientKey: 'k',
      statusCode: 200,
      body: { ok: true },
      expiresAt,
    });
    const second = await store.insertIfAbsent({
      key: 'u1:r:k',
      routeName: 'r',
      userId: 'u1',
      clientKey: 'k',
      statusCode: 500,
      body: { ok: false },
      expiresAt,
    });
    expect(second).toBe('conflict');
    const replay = await store.lookup('u1:r:k');
    // Winner's body is preserved; the loser's attempted body never lands.
    expect(replay?.body).toEqual({ ok: true });
  });

  it('evicts expired rows on lookup and sweepExpired', async () => {
    const store = new InMemoryIdempotencyStore();
    // Already-expired row.
    await store.insertIfAbsent({
      key: 'stale',
      routeName: 'r',
      userId: 'u',
      clientKey: 'k',
      statusCode: 200,
      body: {},
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await store.lookup('stale')).toBeNull();
    // Sweep happily handles already-evicted rows.
    expect(store.sweepExpired()).toBe(0);
    expect(store.size()).toBe(0);
  });
});

describe('PgIdempotencyStore (via fake pool)', () => {
  function createFakePool() {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const rows = new Map<string, { status_code: number; response_body: unknown; expires_at: string }>();

    return {
      queries,
      rows,
      pool: {
        async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
          sql: string,
          params: unknown[] = [],
        ): Promise<{ rows: TRow[]; rowCount: number }> {
          queries.push({ sql, params });
          const normalized = sql.trim().toLowerCase();
          if (normalized.startsWith('insert into idempotency_keys')) {
            const [key, , , , statusCode, responseBody, expiresAt] = params as [
              string,
              string,
              string,
              string,
              number,
              string,
              string,
            ];
            if (rows.has(key)) {
              return { rows: [] as TRow[], rowCount: 0 };
            }
            rows.set(key, {
              status_code: statusCode,
              response_body: JSON.parse(responseBody),
              expires_at: expiresAt,
            });
            return {
              rows: [{ key } as unknown as TRow],
              rowCount: 1,
            };
          }
          if (normalized.startsWith('select status_code, response_body')) {
            const [key] = params as [string];
            const row = rows.get(key);
            if (!row) {
              return { rows: [] as TRow[], rowCount: 0 };
            }
            if (new Date(row.expires_at).getTime() <= Date.now()) {
              return { rows: [] as TRow[], rowCount: 0 };
            }
            return {
              rows: [row as unknown as TRow],
              rowCount: 1,
            };
          }
          return { rows: [] as TRow[], rowCount: 0 };
        },
      },
    };
  }

  it('inserts a new row and replays it through lookup', async () => {
    const { pool, queries } = createFakePool();
    const store = new PgIdempotencyStore(pool);
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const outcome = await store.insertIfAbsent({
      key: 'u:r:k',
      routeName: 'r',
      userId: 'u',
      clientKey: 'k',
      statusCode: 200,
      body: { message_id: 'abc' },
      expiresAt,
    });
    expect(outcome).toBe('inserted');

    const replay = await store.lookup('u:r:k');
    expect(replay).toEqual({ statusCode: 200, body: { message_id: 'abc' } });

    // Sanity: the INSERT SQL is wrapped in ON CONFLICT DO NOTHING.
    expect(queries[0]?.sql).toContain('on conflict (key) do nothing');
  });

  it('returns "conflict" when the row already exists', async () => {
    const { pool } = createFakePool();
    const store = new PgIdempotencyStore(pool);
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    await store.insertIfAbsent({
      key: 'u:r:k',
      routeName: 'r',
      userId: 'u',
      clientKey: 'k',
      statusCode: 200,
      body: { message_id: 'first' },
      expiresAt,
    });
    const second = await store.insertIfAbsent({
      key: 'u:r:k',
      routeName: 'r',
      userId: 'u',
      clientKey: 'k',
      statusCode: 500,
      body: { message_id: 'second' },
      expiresAt,
    });
    expect(second).toBe('conflict');
  });
});
