import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * HTTP-level idempotency for the three critical write paths (post create,
 * chat send, report submit).
 *
 * Contract
 * --------
 *   - Callers send `Idempotency-Key: <uuid-or-any-stable-token>` alongside
 *     the POST body. The server key is composed as
 *     `{userId}:{routeName}:{clientKey}`; mixing in `userId` stops one user
 *     from hijacking another user's client-supplied key.
 *   - On first call: run the handler, then persist the status + response
 *     body under the composite key. On retry inside the TTL: read the
 *     stored row and replay it verbatim (status + body). This matches
 *     Stripe's Idempotency-Key semantics.
 *   - No client header ⇒ pass-through. Existing clients that never send the
 *     header keep working unchanged — this is an opt-in layer.
 *
 * Concurrency
 * -----------
 *   Two retries that race inside the TTL both execute the handler (we
 *   cannot rewind a Fastify handler once run). The second one's INSERT is
 *   gated by `ON CONFLICT (key) DO NOTHING` and, on conflict, the second
 *   request fetches the winner's stored response and returns it. The
 *   handler's side effects on the losing race are left to repository-level
 *   ON CONFLICT / unique indexes (e.g. `uq_messages_client_dedup`,
 *   `uq_contact_requests_active_pair`) to dedup.
 *
 * TTL
 * ---
 *   24h windows are the Stripe-style standard. The api-gateway purge-job
 *   runs hourly in production and deletes rows with `expires_at < now()`.
 */

export interface IdempotencyStore {
  lookup(key: string): Promise<StoredIdempotencyResponse | null>;
  insertIfAbsent(input: StoredIdempotencyResponseInput): Promise<"inserted" | "conflict">;
  close(): Promise<void>;
}

export interface StoredIdempotencyResponse {
  statusCode: number;
  body: unknown;
}

export interface StoredIdempotencyResponseInput {
  key: string;
  routeName: string;
  userId: string;
  clientKey: string;
  statusCode: number;
  body: unknown;
  expiresAt: string;
}

const IDEMPOTENCY_HEADER = "idempotency-key";
export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export function readIdempotencyKey(request: FastifyRequest): string | null {
  // Fastify lowercases all header names on ingest, so callers that send
  // "Idempotency-Key" and "idempotency-key" land in the same slot.
  const raw = request.headers[IDEMPOTENCY_HEADER];
  if (!raw) {
    return null;
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  // Stripe allows up to 255 chars; we mirror that to stop pathological
  // clients from storing 10KB header values as keys.
  if (trimmed.length > 255) {
    return null;
  }
  return trimmed;
}

export function buildCompositeKey(input: { userId: string; routeName: string; clientKey: string }): string {
  return `${input.userId}:${input.routeName}:${input.clientKey}`;
}

export interface IdempotentHandlerContext<TResult> {
  request: FastifyRequest;
  reply: FastifyReply;
  clientKey: string;
  run(): Promise<TResult>;
}

export interface WithIdempotencyOptions<TResult> {
  app: FastifyInstance;
  request: FastifyRequest;
  reply: FastifyReply;
  routeName: string;
  userId: string;
  handler: () => Promise<TResult>;
  ttlSeconds?: number;
}

/**
 * Wraps a route handler with server-side idempotency.
 *
 * Usage (inside a Fastify route `async (request, reply)` callback):
 *
 *     return withIdempotency({
 *       app,
 *       request,
 *       reply,
 *       routeName: 'posts.create',
 *       userId: actor.userId,
 *       handler: async () => {
 *         // original route body, returning the final response payload
 *       },
 *     });
 *
 * If the request has no `Idempotency-Key`, the handler runs as-is. If the
 * request has a key that matches a stored row, the stored status + body are
 * replayed. If the key is new, the handler runs and its result (plus the
 * reply's status code) are persisted before returning.
 */
export async function withIdempotency<TResult>(options: WithIdempotencyOptions<TResult>): Promise<TResult> {
  const { app, request, reply, routeName, userId, handler } = options;
  const clientKey = readIdempotencyKey(request);
  if (!clientKey) {
    return handler();
  }

  const store = app.idempotencyStore;
  if (!store) {
    // Defensive: if no store was installed we still run the handler so
    // callers don't break; but we can't dedupe.
    return handler();
  }

  const compositeKey = buildCompositeKey({ userId, routeName, clientKey });

  const existing = await store.lookup(compositeKey);
  if (existing) {
    reply.code(existing.statusCode);
    reply.header("idempotent-replay", "true");
    return existing.body as TResult;
  }

  const result = await handler();

  // Fastify's `reply.statusCode` reflects any `reply.code(...)` the handler
  // set. Default is 200 for the happy path of these POSTs.
  const statusCode = reply.statusCode || 200;
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const insertion = await store.insertIfAbsent({
    key: compositeKey,
    routeName,
    userId,
    clientKey,
    statusCode,
    body: result,
    expiresAt,
  });

  if (insertion === "conflict") {
    // A concurrent retry beat us to the store. Re-read the winner and hand
    // that back so both callers see the same response shape.
    const winner = await store.lookup(compositeKey);
    if (winner) {
      reply.code(winner.statusCode);
      reply.header("idempotent-replay", "concurrent");
      return winner.body as TResult;
    }
    // Row gone (expired between insert + lookup). Fall through to the
    // current handler's result — this is a vanishingly rare edge case but
    // safe to return.
  }

  return result;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly rows = new Map<
    string,
    {
      statusCode: number;
      body: unknown;
      expiresAtMillis: number;
      routeName: string;
      userId: string;
      clientKey: string;
    }
  >();

  async lookup(key: string): Promise<StoredIdempotencyResponse | null> {
    const entry = this.rows.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAtMillis <= Date.now()) {
      this.rows.delete(key);
      return null;
    }
    return { statusCode: entry.statusCode, body: entry.body };
  }

  async insertIfAbsent(input: StoredIdempotencyResponseInput): Promise<"inserted" | "conflict"> {
    const existing = this.rows.get(input.key);
    if (existing && existing.expiresAtMillis > Date.now()) {
      return "conflict";
    }
    this.rows.set(input.key, {
      statusCode: input.statusCode,
      body: input.body,
      expiresAtMillis: new Date(input.expiresAt).getTime(),
      routeName: input.routeName,
      userId: input.userId,
      clientKey: input.clientKey,
    });
    return "inserted";
  }

  /**
   * Test helper: delete every expired row. The production `PgIdempotencyStore`
   * leaves expired rows in place until the purge-job sweeps them.
   */
  sweepExpired(): number {
    let removed = 0;
    const now = Date.now();
    for (const [key, row] of this.rows.entries()) {
      if (row.expiresAtMillis <= now) {
        this.rows.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  /** Test helper: inspect raw contents. */
  size(): number {
    return this.rows.size;
  }

  async close(): Promise<void> {
    this.rows.clear();
  }
}

export interface PgIdempotencyStorePool {
  query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    queryText: string,
    values?: unknown[],
  ): Promise<{ rows: TRow[]; rowCount?: number | null }>;
  end?(): Promise<void>;
}

export class PgIdempotencyStore implements IdempotencyStore {
  constructor(private readonly pool: PgIdempotencyStorePool) {}

  async lookup(key: string): Promise<StoredIdempotencyResponse | null> {
    const result = await this.pool.query<{
      status_code: number;
      response_body: unknown;
      expires_at: string | Date;
    }>(
      `
        select status_code, response_body, expires_at
        from idempotency_keys
        where key = $1
          and expires_at > now()
        limit 1
      `,
      [key],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      statusCode: row.status_code,
      body: row.response_body,
    };
  }

  async insertIfAbsent(input: StoredIdempotencyResponseInput): Promise<"inserted" | "conflict"> {
    const result = await this.pool.query<{ key: string }>(
      `
        insert into idempotency_keys (
          key,
          route_name,
          user_id,
          client_key,
          status_code,
          response_body,
          expires_at
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
        on conflict (key) do nothing
        returning key
      `,
      [
        input.key,
        input.routeName,
        input.userId,
        input.clientKey,
        input.statusCode,
        JSON.stringify(input.body ?? null),
        input.expiresAt,
      ],
    );

    return (result.rowCount ?? result.rows.length) > 0 ? "inserted" : "conflict";
  }

  async close(): Promise<void> {
    if (this.pool.end) {
      await this.pool.end();
    }
  }
}
