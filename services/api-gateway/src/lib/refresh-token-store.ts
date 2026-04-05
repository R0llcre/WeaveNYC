import { Redis } from 'ioredis';

import type { StoredRefreshSession } from '../types.js';

export interface RefreshTokenStore {
  ping(): Promise<void>;
  store(token: string, session: StoredRefreshSession): Promise<void>;
  close(): Promise<void>;
}

export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number
  ) {}

  async ping(): Promise<void> {
    const pong = await this.redis.ping();
    if (pong !== 'PONG') {
      throw new Error(`Unexpected Redis ping response: ${pong}`);
    }
  }

  async store(token: string, session: StoredRefreshSession): Promise<void> {
    await this.redis.set(this.buildKey(token), JSON.stringify(session), 'EX', this.ttlSeconds);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  private buildKey(token: string): string {
    return `refresh_token:${token}`;
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
