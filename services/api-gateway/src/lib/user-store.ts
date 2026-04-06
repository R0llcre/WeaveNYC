import { Pool, type PoolClient } from 'pg';

import type { AuthenticatedUserRecord } from '../types.js';

export interface UserStore {
  ping(): Promise<void>;
  createAnonymousUser(deviceId: string): Promise<AuthenticatedUserRecord>;
  getAuthUserById(userId: string): Promise<AuthenticatedUserRecord | null>;
  verifyUserPhone(userId: string, phoneHash: string, phoneHashSalt: string): Promise<AuthenticatedUserRecord | null>;
  verifyUserEmail(userId: string, emailHash: string, emailHashSalt: string): Promise<AuthenticatedUserRecord | null>;
  close(): Promise<void>;
}

export class PgUserStore implements UserStore {
  constructor(private readonly pool: Pool) {}

  async ping(): Promise<void> {
    await this.pool.query('select 1');
  }

  async createAnonymousUser(deviceId: string): Promise<AuthenticatedUserRecord> {
    void deviceId;
    const client = await this.pool.connect();

    try {
      const insertResult = await client.query<{
        user_id: string;
        level: AuthenticatedUserRecord['level'];
        status: AuthenticatedUserRecord['status'];
      }>(
        `
          insert into users (level, status, created_at, updated_at)
          values ('anonymous', 'active', now(), now())
          returning user_id, level, status
        `
      );

      const row = insertResult.rows[0];
      const communityIds = await this.loadCommunityIds(client, row.user_id);

      return {
        userId: row.user_id,
        level: row.level,
        role: 'user',
        status: row.status,
        communityIds
      };
    } finally {
      client.release();
    }
  }

  async getAuthUserById(userId: string): Promise<AuthenticatedUserRecord | null> {
    const client = await this.pool.connect();

    try {
      const userResult = await client.query<{
        user_id: string;
        level: AuthenticatedUserRecord['level'];
        status: AuthenticatedUserRecord['status'];
      }>(
        `
          select user_id, level, status
          from users
          where user_id = $1
          limit 1
        `,
        [userId]
      );

      const row = userResult.rows[0];
      if (!row) {
        return null;
      }

      const communityIds = await this.loadCommunityIds(client, row.user_id);

      return {
        userId: row.user_id,
        level: row.level,
        role: row.level === 'anchor' ? 'anchor' : 'user',
        status: row.status,
        communityIds
      };
    } finally {
      client.release();
    }
  }

  async verifyUserPhone(
    userId: string,
    phoneHash: string,
    phoneHashSalt: string
  ): Promise<AuthenticatedUserRecord | null> {
    return this.updateVerifiedIdentity(userId, {
      hashColumn: 'phone_hash',
      saltColumn: 'phone_hash_salt',
      hashValue: phoneHash,
      saltValue: phoneHashSalt
    });
  }

  async verifyUserEmail(
    userId: string,
    emailHash: string,
    emailHashSalt: string
  ): Promise<AuthenticatedUserRecord | null> {
    return this.updateVerifiedIdentity(userId, {
      hashColumn: 'email_hash',
      saltColumn: 'email_hash_salt',
      hashValue: emailHash,
      saltValue: emailHashSalt
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async loadCommunityIds(client: PoolClient, userId: string): Promise<string[]> {
    try {
      const membershipResult = await client.query<{ community_id: string }>(
        `
          select community_id
          from community_members
          where user_id = $1
          order by community_id asc
        `,
        [userId]
      );

      return membershipResult.rows.map((row) => row.community_id);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '42P01') {
        return [];
      }

      throw error;
    }
  }

  private async updateVerifiedIdentity(
    userId: string,
    identity: {
      hashColumn: 'phone_hash' | 'email_hash';
      saltColumn: 'phone_hash_salt' | 'email_hash_salt';
      hashValue: string;
      saltValue: string;
    }
  ): Promise<AuthenticatedUserRecord | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query<{
        user_id: string;
        level: AuthenticatedUserRecord['level'];
        status: AuthenticatedUserRecord['status'];
      }>(
        `
          update users
          set
            ${identity.hashColumn} = $2,
            ${identity.saltColumn} = $3,
            level = case
              when level = 'anonymous' then 'verified'::user_level
              else level
            end,
            updated_at = now()
          where user_id = $1
          returning user_id, level, status
        `,
        [userId, identity.hashValue, identity.saltValue]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      const communityIds = await this.loadCommunityIds(client, row.user_id);

      return {
        userId: row.user_id,
        level: row.level,
        role: row.level === 'anchor' ? 'anchor' : 'user',
        status: row.status,
        communityIds
      };
    } finally {
      client.release();
    }
  }
}

export function createPgUserStore(connectionString: string): PgUserStore {
  return new PgUserStore(
    new Pool({
      connectionString
    })
  );
}
