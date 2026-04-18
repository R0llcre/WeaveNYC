import { Pool } from "pg";

import type { AnalyticsEventInput, AnalyticsEventType } from "@weavenyc/shared";

import { hashIdentity } from "./identity.js";

export interface RecordedAnalyticsEvent {
  event_type: AnalyticsEventType;
  community_id: string | null;
  actor_user_id_hash: string | null;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface AnalyticsRecorder {
  recordEvent(input: AnalyticsEventInput): Promise<void>;
  close(): Promise<void>;
}

function hashActorUserId(userId: string, pepper: string): string {
  return hashIdentity(userId, {
    namespace: "refresh",
    salt: "analytics-actor",
    pepper,
  });
}

function sanitizePayload(payload?: Record<string, unknown>): Record<string, unknown> {
  if (!payload) {
    return {};
  }

  const entries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) {
      continue;
    }

    entries.push([key, value]);
  }

  return Object.fromEntries(entries);
}

export class PgAnalyticsRecorder implements AnalyticsRecorder {
  constructor(
    private readonly pool: Pool,
    private readonly hashPepper: string,
    private readonly logger: { warn: (...args: unknown[]) => void } = console,
  ) {}

  async recordEvent(input: AnalyticsEventInput): Promise<void> {
    const actorHash = input.actor_user_id
      ? hashActorUserId(input.actor_user_id, this.hashPepper)
      : null;
    const payload = sanitizePayload(input.payload);

    try {
      await this.pool.query(
        `INSERT INTO analytics_events (event_type, community_id, actor_user_id_hash, payload)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          input.event_type,
          input.community_id ?? null,
          actorHash,
          JSON.stringify(payload),
        ],
      );
    } catch (error) {
      // Analytics must never break business flows — warn and swallow.
      try {
        this.logger.warn(
          {
            err: error,
            eventType: input.event_type,
          },
          "analytics recordEvent failed",
        );
      } catch {
        // ignore logger failures
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end().catch(() => undefined);
  }
}

export class InMemoryAnalyticsRecorder implements AnalyticsRecorder {
  readonly events: RecordedAnalyticsEvent[] = [];

  constructor(private readonly options: { hashPepper?: string } = {}) {}

  async recordEvent(input: AnalyticsEventInput): Promise<void> {
    const actorHash = input.actor_user_id
      ? this.options.hashPepper
        ? hashActorUserId(input.actor_user_id, this.options.hashPepper)
        : `unhashed:${input.actor_user_id}`
      : null;
    this.events.push({
      event_type: input.event_type,
      community_id: input.community_id ?? null,
      actor_user_id_hash: actorHash,
      occurred_at: new Date().toISOString(),
      payload: sanitizePayload(input.payload),
    });
  }

  async close(): Promise<void> {
    // no-op
  }
}

export function createPgAnalyticsRecorder(
  pool: Pool,
  hashPepper: string,
  logger?: { warn: (...args: unknown[]) => void },
): AnalyticsRecorder {
  return new PgAnalyticsRecorder(pool, hashPepper, logger);
}

export function createPgAnalyticsRecorderFromUrl(
  databaseUrl: string,
  hashPepper: string,
  logger?: { warn: (...args: unknown[]) => void },
): AnalyticsRecorder {
  const pool = new Pool({ connectionString: databaseUrl });
  return new PgAnalyticsRecorder(pool, hashPepper, logger);
}
