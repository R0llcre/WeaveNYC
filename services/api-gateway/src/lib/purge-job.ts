import { createHash } from "node:crypto";

import type { FastifyBaseLogger } from "fastify";
import * as nodeCron from "node-cron";
import type { Pool, PoolClient } from "pg";

export interface PurgeJob {
  start(): void;
  stop(): Promise<void>;
  runOnce(): Promise<{ deletedUsers: number }>;
}

export interface PurgeJobConfig {
  pool: Pool;
  enabled: boolean;
  /**
   * cron expression (UTC). Defaults to "0 0 * * *" (daily at 00:00 UTC).
   */
  schedule?: string;
  /**
   * Optional pepper mixed into the analytics actor hash so stored
   * `actor_user_id_hash` values cannot be reversed.
   */
  actorHashPepper?: string;
  logger?: FastifyBaseLogger;
}

const DEFAULT_SCHEDULE = "0 0 * * *";

function hashActorUserId(userId: string, pepper?: string): string {
  return createHash("sha256")
    .update(`${pepper ?? ""}:${userId}`)
    .digest("hex");
}

/**
 * Creates a cron-driven purge worker that removes soft-deleted user rows
 * once their 30-day grace period has elapsed.
 *
 * Cascade order (single transaction per user):
 *   1. messages whose sender is the user OR whose conversation is linked
 *      to one of the user's contact_requests
 *   2. conversation_reads tied to the user or those conversations
 *   3. blocks referencing the user (as blocker/blocked) or those conversations
 *   4. reports whose reporter is the user or that reference those conversations
 *   5. conversations linked to the user's contact_requests
 *   6. contact_requests involving the user
 *   7. match_suggestions whose request_post_id belongs to the user
 *   8. posts created by the user
 *   9. community_members rows for the user
 *  10. nullable FK fan-out (moderation_actions, announcements, community_rulesets,
 *      anchor_invites, community_sync_events) — because a few FK columns are
 *      NOT NULL (announcements.created_by) we delete those rows rather than null them.
 *  11. anchors rows for the user
 *  12. finally, the users row itself
 *
 * After the transaction commits we emit an `account_purged` analytics event for
 * the user. Refresh-token sessions live in Redis and were already revoked at
 * soft-delete time, so there is nothing to clean up here.
 */
export function createPurgeJob(config: PurgeJobConfig): PurgeJob {
  const schedule = config.schedule ?? DEFAULT_SCHEDULE;
  const logger = config.logger;

  if (!nodeCron.validate(schedule)) {
    throw new Error(`Invalid cron schedule for purge-job: ${schedule}`);
  }

  let scheduled: ReturnType<typeof nodeCron.schedule> | null = null;
  let runInFlight: Promise<{ deletedUsers: number }> | null = null;
  let stopping = false;

  async function runOnce(): Promise<{ deletedUsers: number }> {
    if (runInFlight) {
      return runInFlight;
    }

    runInFlight = (async () => {
      const client = await config.pool.connect();
      try {
        return await executePurge(client, logger, config.actorHashPepper);
      } finally {
        client.release();
      }
    })();

    try {
      return await runInFlight;
    } finally {
      runInFlight = null;
    }
  }

  function start(): void {
    if (!config.enabled) {
      logger?.info({ schedule }, "purge-job disabled by config; cron not scheduled");
      return;
    }
    if (scheduled) {
      return;
    }

    scheduled = nodeCron.schedule(
      schedule,
      async () => {
        if (stopping) {
          return;
        }
        try {
          const result = await runOnce();
          if (result.deletedUsers > 0) {
            logger?.info(
              { deletedUsers: result.deletedUsers },
              "purge-job deleted expired soft-deleted users",
            );
          } else {
            logger?.debug?.({ deletedUsers: 0 }, "purge-job found no users to purge");
          }
        } catch (error) {
          logger?.error({ err: error }, "purge-job tick failed");
        }
      },
      { timezone: "Etc/UTC", name: "weavenyc-account-purge" },
    );
    logger?.info({ schedule }, "purge-job scheduled");
  }

  async function stop(): Promise<void> {
    stopping = true;
    if (scheduled) {
      try {
        await scheduled.stop();
      } catch (error) {
        logger?.warn({ err: error }, "purge-job failed to stop cron cleanly");
      }
      scheduled = null;
    }
    if (runInFlight) {
      try {
        await runInFlight;
      } catch {
        // swallowed: failures are already logged inside runOnce()
      }
    }
  }

  return { start, stop, runOnce };
}

async function executePurge(
  client: PoolClient,
  logger: FastifyBaseLogger | undefined,
  actorHashPepper: string | undefined,
): Promise<{ deletedUsers: number }> {
  const dueUsers = await client.query<{
    user_id: string;
    deleted_at: Date | string | null;
    purge_at: Date | string | null;
  }>(
    `
      select user_id, deleted_at, purge_at
      from users
      where status = 'deleted'
        and purge_at is not null
        and purge_at < now()
      order by purge_at asc
      limit 500
    `,
  );

  let deletedUsers = 0;

  for (const row of dueUsers.rows) {
    const userId = row.user_id;
    const deletedAt = row.deleted_at ? new Date(row.deleted_at) : null;
    const purgedAt = new Date();
    const daysSinceDelete = deletedAt
      ? Math.max(0, Math.round((purgedAt.getTime() - deletedAt.getTime()) / 86_400_000))
      : 0;

    try {
      await client.query("begin");

      // 1. messages where sender = user, or conversation tied to user's contact_requests
      await client.query(
        `
          delete from messages
          where sender_user_id = $1
             or conversation_id in (
               select conversation_id from conversations
               where contact_request_id in (
                 select contact_request_id from contact_requests
                 where requester_user_id = $1 or recipient_user_id = $1
               )
             )
        `,
        [userId],
      );

      // 2. conversation_reads tied to user or user-involved conversations
      await client.query(
        `
          delete from conversation_reads
          where user_id = $1
             or conversation_id in (
               select conversation_id from conversations
               where contact_request_id in (
                 select contact_request_id from contact_requests
                 where requester_user_id = $1 or recipient_user_id = $1
               )
             )
        `,
        [userId],
      );

      // 3. blocks referencing the user as blocker/blocked, or user-involved conversations
      await client.query(
        `
          delete from blocks
          where blocker_user_id = $1
             or blocked_user_id = $1
             or conversation_id in (
               select conversation_id from conversations
               where contact_request_id in (
                 select contact_request_id from contact_requests
                 where requester_user_id = $1 or recipient_user_id = $1
               )
             )
        `,
        [userId],
      );

      // 4. reports reporter = user, or referencing user-involved conversations
      await client.query(
        `
          delete from reports
          where reporter_user_id = $1
             or conversation_id in (
               select conversation_id from conversations
               where contact_request_id in (
                 select contact_request_id from contact_requests
                 where requester_user_id = $1 or recipient_user_id = $1
               )
             )
        `,
        [userId],
      );

      // 5. conversations linked to user's contact_requests (participants have no FK)
      await client.query(
        `
          delete from conversations
          where contact_request_id in (
            select contact_request_id from contact_requests
            where requester_user_id = $1 or recipient_user_id = $1
          )
        `,
        [userId],
      );

      // 6. contact_requests directly involving the user
      await client.query(
        `
          delete from contact_requests
          where requester_user_id = $1
             or recipient_user_id = $1
        `,
        [userId],
      );

      // 7. match_suggestions for the user's posts (request_post_id FK)
      await client.query(
        `
          delete from match_suggestions
          where request_post_id in (
            select post_id from posts where created_by = $1
          )
        `,
        [userId],
      );

      // Defensive: remove any stray contact_requests still referencing the user's posts
      // as from/to but authored by another user (shouldn't exist because step 6
      // already removes them, but FK wise we still need to guard before post deletion)
      await client.query(
        `
          delete from contact_requests
          where from_post_id in (select post_id from posts where created_by = $1)
             or to_post_id in (select post_id from posts where created_by = $1)
        `,
        [userId],
      );

      // 8. posts authored by the user
      await client.query(
        `
          delete from posts
          where created_by = $1
        `,
        [userId],
      );

      // 9. community_members rows for the user
      await client.query(
        `
          delete from community_members
          where user_id = $1
        `,
        [userId],
      );

      // 10a. moderation_actions.anchor_user_id (nullable)
      await client.query(
        `
          update moderation_actions
          set anchor_user_id = null
          where anchor_user_id = $1
        `,
        [userId],
      );

      // 10b. announcements.created_by is NOT NULL; remove rows authored by user.
      await client.query(
        `
          delete from announcements
          where created_by = $1
        `,
        [userId],
      );

      // 10c. community_rulesets.created_by (nullable)
      await client.query(
        `
          update community_rulesets
          set created_by = null
          where created_by = $1
        `,
        [userId],
      );

      // 10d. anchor_invites.consumed_by_user_id (nullable)
      await client.query(
        `
          update anchor_invites
          set consumed_by_user_id = null
          where consumed_by_user_id = $1
        `,
        [userId],
      );

      // 10e. community_sync_events.actor_user_id (nullable) +
      //      payload_json tombstone + actor_p2p_id scrub for identifiable
      //      aggregate types (post/announcement/report). The prior implementation
      //      nulled out actor_user_id only, leaving payload_json as a verbatim
      //      snapshot of the user's post body / title / etc. – so a 30-day
      //      soft-deleted user's original content was still replayable via the
      //      community /sync feed after their account was fully purged. That
      //      also applies to actor_p2p_id, which is a stable per-user+community
      //      pseudonym: leaving it in place would allow observers to re-link
      //      events to the deleted account. Rewriting payload_json to a minimal
      //      tombstone and nulling actor_p2p_id closes both leaks while keeping
      //      the causal row present so downstream cursors still advance.
      await client.query(
        `
          update community_sync_events
          set
            payload_json = jsonb_build_object('tombstoned', true, 'reason', 'user_deleted'),
            actor_user_id = null,
            actor_p2p_id = null
          where actor_user_id = $1
            and aggregate_type in ('post', 'announcement', 'report')
        `,
        [userId],
      );

      await client.query(
        `
          update community_sync_events
          set actor_user_id = null
          where actor_user_id = $1
        `,
        [userId],
      );

      // 10f. communities.created_by (nullable in some migrations; guard with try/null).
      // If the column doesn't exist we skip.
      try {
        await client.query(
          `
            update communities
            set created_by = null
            where created_by = $1
          `,
          [userId],
        );
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "42703") {
          throw error;
        }
      }

      // 11. anchors rows for the user
      await client.query(
        `
          delete from anchors
          where user_id = $1
        `,
        [userId],
      );

      // 12. users row itself
      const deleteResult = await client.query<{ user_id: string }>(
        `
          delete from users
          where user_id = $1
            and status = 'deleted'
            and purge_at is not null
            and purge_at < now()
          returning user_id
        `,
        [userId],
      );

      if (deleteResult.rowCount && deleteResult.rowCount > 0) {
        deletedUsers += 1;
        await client.query(
          `
            insert into analytics_events (event_type, actor_user_id_hash, occurred_at, payload)
            values ($1, $2, now(), $3::jsonb)
          `,
          [
            "account_purged",
            hashActorUserId(userId, actorHashPepper),
            JSON.stringify({ days_since_delete: daysSinceDelete }),
          ],
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      logger?.error(
        { err: error, userId },
        "purge-job failed to purge user; transaction rolled back",
      );
    }
  }

  return { deletedUsers };
}
