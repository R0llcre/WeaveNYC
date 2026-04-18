import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';

import type {
  AnchorAdminRecord,
  AnchorInviteRecord,
  AuthenticatedUserRecord
} from '../types.js';

export interface UserDeletionIdentity {
  userId: string;
  status: AuthenticatedUserRecord['status'];
  hasPhoneHash: boolean;
  hasEmailHash: boolean;
  deletedAt: string | null;
  purgeAt: string | null;
  deletionReason: string | null;
}

export interface ConfirmAccountDeletionResult {
  userId: string;
  purgeAt: string;
  hadAnchorRole: boolean;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export interface UserStore {
  ping(): Promise<void>;
  createAnonymousUser(deviceId: string): Promise<AuthenticatedUserRecord>;
  getAuthUserById(userId: string): Promise<AuthenticatedUserRecord | null>;
  verifyUserPhone(userId: string, phoneHash: string, phoneHashSalt: string): Promise<AuthenticatedUserRecord | null>;
  verifyUserEmail(userId: string, emailHash: string, emailHashSalt: string): Promise<AuthenticatedUserRecord | null>;
  findAnchorInviteByCodeHash(codeHash: string): Promise<AnchorInviteRecord | null>;
  getActiveAnchorByUser(userId: string, communityId: string): Promise<AnchorAdminRecord | null>;
  activateAnchor(input: {
    userId: string;
    inviteId: string;
    totpSecretCiphertext: string;
    recoveryCodesHashes: string[];
    activatedAt: string;
  }): Promise<AuthenticatedUserRecord | null>;
  recordAnchorMfa(input: {
    userId: string;
    communityId: string;
    occurredAt: string;
  }): Promise<void>;
  scheduleAccountDeletion(input: {
    userId: string;
    reason?: string;
    purgeAt: string;
  }): Promise<{ userId: string; purgeAt: string } | null>;
  getDeletionIdentity(userId: string): Promise<UserDeletionIdentity | null>;
  countActiveAnchorsInCommunity(
    communityId: string,
    excludeUserId?: string
  ): Promise<number>;
  listActiveAnchorCommunitiesForUser(userId: string): Promise<string[]>;
  confirmAccountDeletion(input: {
    userId: string;
    reason?: string;
    purgeAt: string;
  }): Promise<ConfirmAccountDeletionResult | null>;
  undeleteAccount(input: {
    userId: string;
  }): Promise<AuthenticatedUserRecord | null>;
  consumeAnchorRecoveryCode(input: {
    userId: string;
    communityId: string;
    codeHash: string;
  }): Promise<{ remaining: number } | null>;
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
      const anchorCommunityId = await this.loadAnchorCommunityId(client, row.user_id);

      return {
        userId: row.user_id,
        level: row.level,
        role: 'user',
        status: row.status,
        communityIds,
        anchorCommunityId
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
      const anchorCommunityId = await this.loadAnchorCommunityId(client, row.user_id);

      return {
        userId: row.user_id,
        level: row.level,
        role: row.level === 'anchor' ? 'anchor' : 'user',
        status: row.status,
        communityIds,
        anchorCommunityId
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

  async findAnchorInviteByCodeHash(codeHash: string): Promise<AnchorInviteRecord | null> {
    const result = await this.pool.query<{
      invite_id: string;
      org_name: string | null;
      community_id: string;
      name: string;
      center_zip: string;
      join_policy: "invite_only" | "open";
    }>(
      `
        select
          ai.anchor_invite_id as invite_id,
          ai.org_name,
          c.community_id,
          c.name,
          c.center_zip,
          c.join_policy
        from anchor_invites ai
        join communities c
          on c.community_id = ai.community_id
        where ai.code_hash = $1
          and ai.status = 'active'
          and (ai.expires_at is null or ai.expires_at > now())
        limit 1
      `,
      [codeHash]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      inviteId: row.invite_id,
      orgName: row.org_name ?? row.name,
      community: {
        communityId: row.community_id,
        name: row.name,
        centerZip: row.center_zip,
        joinPolicy: row.join_policy
      }
    };
  }

  async getActiveAnchorByUser(userId: string, communityId: string): Promise<AnchorAdminRecord | null> {
    const result = await this.pool.query<{
      anchor_id: string;
      user_id: string;
      community_id: string;
      org_name: string;
      status: "pending_activation" | "active" | "revoked";
      totp_secret_ciphertext: string | null;
      recovery_codes_hashes: string[] | null;
      activated_at: Date | string | null;
      last_mfa_at: Date | string | null;
    }>(
      `
        select
          anchor_id,
          user_id,
          community_id,
          org_name,
          status,
          totp_secret_ciphertext,
          recovery_codes_hashes,
          activated_at,
          last_mfa_at
        from anchors
        where user_id = $1
          and community_id = $2
          and status = 'active'
        limit 1
      `,
      [userId, communityId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      anchorId: row.anchor_id,
      userId: row.user_id,
      communityId: row.community_id,
      orgName: row.org_name,
      status: row.status,
      totpSecretCiphertext: row.totp_secret_ciphertext,
      recoveryCodesHashes: row.recovery_codes_hashes ?? [],
      activatedAt: row.activated_at ? toIso(row.activated_at) : null,
      lastMfaAt: row.last_mfa_at ? toIso(row.last_mfa_at) : null
    };
  }

  async activateAnchor(input: {
    userId: string;
    inviteId: string;
    totpSecretCiphertext: string;
    recoveryCodesHashes: string[];
    activatedAt: string;
  }): Promise<AuthenticatedUserRecord | null> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const inviteResult = await client.query<{
        anchor_invite_id: string;
        community_id: string;
        org_name: string | null;
      }>(
        `
          select
            anchor_invite_id,
            community_id,
            org_name
          from anchor_invites
          where anchor_invite_id = $1
            and status = 'active'
            and (expires_at is null or expires_at > now())
          for update
        `,
        [input.inviteId]
      );

      const invite = inviteResult.rows[0];
      if (!invite) {
        await client.query("rollback");
        return null;
      }

      const existingAnchorResult = await client.query<{ user_id: string }>(
        `
          select user_id
          from anchors
          where community_id = $1
            and status = 'active'
          for update
        `,
        [invite.community_id]
      );
      const displacedAnchorUserId = existingAnchorResult.rows[0]?.user_id ?? null;

      await client.query(
        `
          update users
          set level = 'anchor',
              updated_at = now()
          where user_id = $1
        `,
        [input.userId]
      );

      await client.query(
        `
          insert into community_members (user_id, community_id, joined_at)
          values ($1, $2, now())
          on conflict (user_id, community_id) do nothing
        `,
        [input.userId, invite.community_id]
      );

      await client.query(
        `
          insert into anchors (
            anchor_id,
            user_id,
            community_id,
            org_name,
            status,
            totp_secret_ciphertext,
            recovery_codes_hashes,
            activated_at,
            last_mfa_at,
            created_at
          )
          values ($1, $2, $3, $4, 'active', $5, $6, $7, $7, now())
          on conflict (community_id) where status = 'active'
          do update
          set
            user_id = excluded.user_id,
            org_name = excluded.org_name,
            status = 'active',
            totp_secret_ciphertext = excluded.totp_secret_ciphertext,
            recovery_codes_hashes = excluded.recovery_codes_hashes,
            activated_at = excluded.activated_at,
            last_mfa_at = excluded.last_mfa_at
        `,
        [
          randomUUID(),
          input.userId,
          invite.community_id,
          invite.org_name ?? "Community Anchor",
          input.totpSecretCiphertext,
          input.recoveryCodesHashes,
          input.activatedAt
        ]
      );

      await client.query(
        `
          update anchor_invites
          set status = 'consumed',
              consumed_by_user_id = $2,
              consumed_at = now()
          where anchor_invite_id = $1
        `,
        [input.inviteId, input.userId]
      );

      if (displacedAnchorUserId && displacedAnchorUserId !== input.userId) {
        await client.query(
          `
            update users
            set level = 'verified',
                updated_at = now()
            where user_id = $1
              and level = 'anchor'
              and not exists (
                select 1
                from anchors
                where user_id = $1
                  and status = 'active'
              )
          `,
          [displacedAnchorUserId]
        );
      }

      await client.query("commit");
      return this.getAuthUserById(input.userId);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordAnchorMfa(input: {
    userId: string;
    communityId: string;
    occurredAt: string;
  }): Promise<void> {
    await this.pool.query(
      `
        update anchors
        set last_mfa_at = $3
        where user_id = $1
          and community_id = $2
          and status = 'active'
      `,
      [input.userId, input.communityId, input.occurredAt]
    );
  }

  async consumeAnchorRecoveryCode(input: {
    userId: string;
    communityId: string;
    codeHash: string;
  }): Promise<{ remaining: number } | null> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");

      const anchorResult = await client.query<{
        anchor_id: string;
        recovery_codes_hashes: string[] | null;
      }>(
        `
          select anchor_id, recovery_codes_hashes
          from anchors
          where user_id = $1
            and community_id = $2
            and status = 'active'
          for update
        `,
        [input.userId, input.communityId]
      );

      const row = anchorResult.rows[0];
      if (!row) {
        await client.query("rollback");
        return null;
      }

      const hashes = row.recovery_codes_hashes ?? [];
      const index = hashes.indexOf(input.codeHash);
      if (index === -1) {
        await client.query("rollback");
        return null;
      }

      const remaining = hashes.slice(0, index).concat(hashes.slice(index + 1));
      await client.query(
        `
          update anchors
          set recovery_codes_hashes = $2
          where anchor_id = $1
        `,
        [row.anchor_id, remaining]
      );

      await client.query("commit");
      return { remaining: remaining.length };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async scheduleAccountDeletion(input: {
    userId: string;
    reason?: string;
    purgeAt: string;
  }): Promise<{ userId: string; purgeAt: string } | null> {
    const result = await this.confirmAccountDeletion(input);
    if (!result) {
      return null;
    }

    return { userId: result.userId, purgeAt: result.purgeAt };
  }

  async getDeletionIdentity(userId: string): Promise<UserDeletionIdentity | null> {
    const result = await this.pool.query<{
      user_id: string;
      status: AuthenticatedUserRecord['status'];
      phone_hash: string | null;
      email_hash: string | null;
      deleted_at: Date | string | null;
      purge_at: Date | string | null;
      deletion_reason: string | null;
    }>(
      `
        select user_id, status, phone_hash, email_hash, deleted_at, purge_at, deletion_reason
        from users
        where user_id = $1
        limit 1
      `,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      status: row.status,
      hasPhoneHash: Boolean(row.phone_hash && row.phone_hash.length > 0),
      hasEmailHash: Boolean(row.email_hash && row.email_hash.length > 0),
      deletedAt: row.deleted_at ? toIso(row.deleted_at) : null,
      purgeAt: row.purge_at ? toIso(row.purge_at) : null,
      deletionReason: row.deletion_reason ?? null
    };
  }

  async countActiveAnchorsInCommunity(
    communityId: string,
    excludeUserId?: string
  ): Promise<number> {
    const params: unknown[] = [communityId];
    let where = "community_id = $1 and status = 'active'";
    if (excludeUserId) {
      params.push(excludeUserId);
      where += ` and user_id <> $${params.length}`;
    }

    const result = await this.pool.query<{ count: string }>(
      `
        select count(*)::text as count
        from anchors
        where ${where}
      `,
      params
    );
    return Number(result.rows[0]?.count ?? '0');
  }

  async listActiveAnchorCommunitiesForUser(userId: string): Promise<string[]> {
    try {
      const result = await this.pool.query<{ community_id: string }>(
        `
          select community_id
          from anchors
          where user_id = $1
            and status = 'active'
          order by community_id asc
        `,
        [userId]
      );
      return result.rows.map((row) => row.community_id);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '42P01') {
        return [];
      }
      throw error;
    }
  }

  async confirmAccountDeletion(input: {
    userId: string;
    reason?: string;
    purgeAt: string;
  }): Promise<ConfirmAccountDeletionResult | null> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");

      const updateResult = await client.query<{ user_id: string; status: string }>(
        `
          update users
          set
            status = 'deleted',
            display_name = null,
            preferred_languages = null,
            home_zip = null,
            phone_hash = null,
            phone_hash_salt = null,
            email_hash = null,
            email_hash_salt = null,
            deleted_at = now(),
            purge_at = $2,
            deletion_reason = $3,
            updated_at = now()
          where user_id = $1
            and status <> 'deleted'
          returning user_id, status
        `,
        [input.userId, input.purgeAt, input.reason ?? null]
      );

      const row = updateResult.rows[0];
      if (!row) {
        await client.query("rollback");
        return null;
      }

      const anchorUpdate = await client.query<{ anchor_id: string }>(
        `
          update anchors
          set status = 'revoked'
          where user_id = $1
            and status = 'active'
          returning anchor_id
        `,
        [input.userId]
      );

      await client.query("commit");
      return {
        userId: row.user_id,
        purgeAt: input.purgeAt,
        hadAnchorRole: anchorUpdate.rows.length > 0
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async undeleteAccount(input: {
    userId: string;
  }): Promise<AuthenticatedUserRecord | null> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");

      const updateResult = await client.query<{
        user_id: string;
        level: AuthenticatedUserRecord['level'];
        status: AuthenticatedUserRecord['status'];
      }>(
        `
          update users
          set
            status = 'active',
            deleted_at = null,
            purge_at = null,
            deletion_reason = null,
            level = 'anonymous',
            updated_at = now()
          where user_id = $1
            and status = 'deleted'
            and (purge_at is null or purge_at > now())
          returning user_id, level, status
        `,
        [input.userId]
      );

      const row = updateResult.rows[0];
      if (!row) {
        await client.query("rollback");
        return null;
      }

      const communityIds = await this.loadCommunityIds(client, row.user_id);
      const anchorCommunityId = await this.loadAnchorCommunityId(client, row.user_id);
      await client.query("commit");

      return {
        userId: row.user_id,
        level: row.level,
        role: row.level === 'anchor' ? 'anchor' : 'user',
        status: row.status,
        communityIds,
        anchorCommunityId
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
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

  private async loadAnchorCommunityId(client: PoolClient, userId: string): Promise<string | null> {
    try {
      const result = await client.query<{ community_id: string }>(
        `
          select community_id
          from anchors
          where user_id = $1
            and status = 'active'
          order by created_at desc
          limit 1
        `,
        [userId]
      );

      return result.rows[0]?.community_id ?? null;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '42P01' || code === '42703') {
        return null;
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
      const anchorCommunityId = await this.loadAnchorCommunityId(client, row.user_id);

      return {
        userId: row.user_id,
        level: row.level,
        role: row.level === 'anchor' ? 'anchor' : 'user',
        status: row.status,
        communityIds,
        anchorCommunityId
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
