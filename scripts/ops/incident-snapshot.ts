#!/usr/bin/env tsx
/**
 * Post-incident snapshot tool.
 *
 * Captures a consistent read of PostgreSQL state + Redis info so that
 * operators can triage after an outage without hand-rolling SQL. The
 * snapshot is deliberately non-sensitive (counts, statuses, stream
 * lengths) so it can be shared with external stakeholders in an
 * incident post-mortem without touching user PII.
 *
 * Usage:
 *   pnpm tsx scripts/ops/incident-snapshot.ts --output ./snapshots/2026-04-16_incident.json
 *   pnpm tsx scripts/ops/incident-snapshot.ts --period-hours 48
 *
 * Flags:
 *   --output <path>            Destination JSON file (default: stdout).
 *   --period-hours <n>         Analytics window (default: 24).
 *   --database-url <url>       Override DATABASE_URL.
 *   --redis-url <url>          Override REDIS_URL.
 *
 * Exit codes:
 *   0  snapshot written
 *   1  one or more required clients failed; partial snapshot still written
 *      when --output is provided
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

import { Pool, type QueryResult } from 'pg';
import Redis from 'ioredis';

interface CliOptions {
  output: string | null;
  periodHours: number;
  databaseUrl: string;
  redisUrl: string;
}

interface PostgresSnapshot {
  connected: boolean;
  error?: string;
  analytics_events_by_type: Record<string, number>;
  users_by_status: Record<string, number>;
  posts_by_status: Record<string, number>;
  conversations_by_status: Record<string, number>;
  anchors_by_community: Array<{
    community_id: string;
    community_name: string | null;
    active_anchor_count: number;
  }>;
  pgbouncer: {
    active_connections: number | null;
    idle_connections: number | null;
  };
}

interface RedisSnapshot {
  connected: boolean;
  error?: string;
  dbsize: number | null;
  chat_streams: Array<{ key: string; length: number; first_entry: string | null; last_entry: string | null }>;
  memory_used_bytes: number | null;
}

interface IncidentSnapshot {
  timestamp: string;
  period_hours: number;
  node_version: string;
  hostname: string;
  postgres: PostgresSnapshot;
  redis: RedisSnapshot;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    output: null,
    periodHours: 24,
    databaseUrl:
      process.env.DATABASE_URL ?? 'postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output' && argv[i + 1]) {
      options.output = resolve(argv[i + 1]!);
      i += 1;
    } else if (arg === '--period-hours' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1]!, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.periodHours = parsed;
      }
      i += 1;
    } else if (arg === '--database-url' && argv[i + 1]) {
      options.databaseUrl = argv[i + 1]!;
      i += 1;
    } else if (arg === '--redis-url' && argv[i + 1]) {
      options.redisUrl = argv[i + 1]!;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: pnpm tsx scripts/ops/incident-snapshot.ts [--output PATH] [--period-hours N] [--database-url URL] [--redis-url URL]',
      );
      process.exit(0);
    }
  }

  return options;
}

function emptySnapshot(): PostgresSnapshot {
  return {
    connected: false,
    analytics_events_by_type: {},
    users_by_status: {},
    posts_by_status: {},
    conversations_by_status: {},
    anchors_by_community: [],
    pgbouncer: {
      active_connections: null,
      idle_connections: null,
    },
  };
}

function emptyRedisSnapshot(): RedisSnapshot {
  return {
    connected: false,
    dbsize: null,
    chat_streams: [],
    memory_used_bytes: null,
  };
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [table],
  );
  return result.rows[0]?.exists === true;
}

async function countsByColumn(
  pool: Pool,
  table: string,
  column: string,
  where?: string,
  params: unknown[] = [],
): Promise<Record<string, number>> {
  if (!(await tableExists(pool, table))) {
    return {};
  }

  const clause = where ? `WHERE ${where}` : '';
  const query = `SELECT ${column} AS key, COUNT(*)::int AS total
                   FROM ${table}
                   ${clause}
                   GROUP BY ${column}
                   ORDER BY ${column}`;
  const result: QueryResult<{ key: string | null; total: number }> = await pool.query(query, params);
  const acc: Record<string, number> = {};
  for (const row of result.rows) {
    acc[row.key ?? 'unknown'] = row.total;
  }
  return acc;
}

async function snapshotPostgres(
  databaseUrl: string,
  periodHours: number,
): Promise<PostgresSnapshot> {
  const snapshot = emptySnapshot();
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });

  try {
    await pool.query('SELECT 1');
    snapshot.connected = true;

    snapshot.analytics_events_by_type = await countsByColumn(
      pool,
      'analytics_events',
      'event_type',
      'occurred_at >= NOW() - ($1 || \' hours\')::interval',
      [String(periodHours)],
    );

    snapshot.users_by_status = await countsByColumn(pool, 'users', 'status');
    snapshot.posts_by_status = await countsByColumn(pool, 'posts', 'status');
    snapshot.conversations_by_status = await countsByColumn(
      pool,
      'conversations',
      'status',
    );

    if (await tableExists(pool, 'anchors')) {
      const anchorQuery = (await tableExists(pool, 'communities'))
        ? `SELECT a.community_id::text AS community_id,
                  c.name AS community_name,
                  COUNT(*)::int AS active_anchor_count
             FROM anchors a
             LEFT JOIN communities c ON c.community_id = a.community_id
            WHERE a.status = 'active'
            GROUP BY a.community_id, c.name
            ORDER BY a.community_id`
        : `SELECT community_id::text AS community_id,
                  NULL::text AS community_name,
                  COUNT(*)::int AS active_anchor_count
             FROM anchors
            WHERE status = 'active'
            GROUP BY community_id
            ORDER BY community_id`;
      const anchorResult = await pool.query<{
        community_id: string;
        community_name: string | null;
        active_anchor_count: number;
      }>(anchorQuery);
      snapshot.anchors_by_community = anchorResult.rows;
    }

    try {
      // `pg_stat_activity` requires at least the "pg_monitor" role or
      // default connection — on managed Postgres we gracefully fall back.
      const stats = await pool.query<{ state: string | null; total: number }>(
        `SELECT state, COUNT(*)::int AS total
           FROM pg_stat_activity
          WHERE datname = current_database()
          GROUP BY state`,
      );
      let active = 0;
      let idle = 0;
      for (const row of stats.rows) {
        if (row.state === 'active') {
          active = row.total;
        } else if (row.state === 'idle') {
          idle = row.total;
        }
      }
      snapshot.pgbouncer = { active_connections: active, idle_connections: idle };
    } catch (error) {
      snapshot.pgbouncer = { active_connections: null, idle_connections: null };
      // don't fail the whole snapshot if we can't read pg_stat_activity
      void error;
    }
  } catch (error) {
    snapshot.error = error instanceof Error ? error.message : String(error);
  } finally {
    await pool.end().catch(() => undefined);
  }

  return snapshot;
}

async function snapshotRedis(redisUrl: string): Promise<RedisSnapshot> {
  const snapshot = emptyRedisSnapshot();
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: true,
  });

  try {
    await client.connect();
    snapshot.connected = true;
    snapshot.dbsize = await client.dbsize();

    try {
      const memoryInfo = await client.info('memory');
      const match = /used_memory:(\d+)/.exec(memoryInfo);
      if (match) {
        snapshot.memory_used_bytes = Number.parseInt(match[1]!, 10);
      }
    } catch {
      snapshot.memory_used_bytes = null;
    }

    const streamKeys: string[] = [];
    let cursor = '0';
    // SCAN with MATCH chat:stream:* — Redis exposes only chat realtime streams
    // under a deterministic prefix. Abort after 10 iterations to cap cost.
    for (let iteration = 0; iteration < 10; iteration += 1) {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        'chat:stream:*',
        'COUNT',
        '100',
      );
      streamKeys.push(...keys);
      cursor = nextCursor;
      if (cursor === '0') {
        break;
      }
    }

    for (const key of streamKeys) {
      try {
        const xinfo = (await client.xinfo('STREAM', key)) as Array<string | number>;
        const info: Record<string, string | number | null> = {};
        for (let i = 0; i < xinfo.length; i += 2) {
          const field = xinfo[i];
          const value = xinfo[i + 1];
          if (typeof field === 'string') {
            info[field] = typeof value === 'string' || typeof value === 'number' ? value : null;
          }
        }
        snapshot.chat_streams.push({
          key,
          length: Number(info['length'] ?? 0),
          first_entry: info['first-entry'] ? String(info['first-entry']) : null,
          last_entry: info['last-entry'] ? String(info['last-entry']) : null,
        });
      } catch {
        // If a stream was deleted mid-scan just skip it; incident snapshots
        // are best-effort and an empty entry is better than aborting.
      }
    }
  } catch (error) {
    snapshot.error = error instanceof Error ? error.message : String(error);
  } finally {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }

  return snapshot;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [postgres, redis] = await Promise.all([
    snapshotPostgres(options.databaseUrl, options.periodHours),
    snapshotRedis(options.redisUrl),
  ]);

  const snapshot: IncidentSnapshot = {
    timestamp: new Date().toISOString(),
    period_hours: options.periodHours,
    node_version: process.version,
    hostname: process.env.HOSTNAME ?? 'unknown',
    postgres,
    redis,
  };

  const serialized = JSON.stringify(snapshot, null, 2);

  if (options.output) {
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, `${serialized}\n`, 'utf8');
    console.error(`incident snapshot written to ${options.output}`);
  } else {
    process.stdout.write(`${serialized}\n`);
  }

  const fatal = !postgres.connected && !redis.connected;
  process.exit(fatal ? 1 : 0);
}

void main().catch((error) => {
  console.error('incident-snapshot failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
