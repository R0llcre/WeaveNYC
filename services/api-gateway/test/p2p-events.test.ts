import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import type { CommunitySyncEvent } from '@weavenyc/shared';

import {
  fanoutSyncEvents,
  publishAnnouncementEvent,
  publishPostEvent,
} from '../src/lib/p2p-events.js';
import {
  InMemoryP2PSyncRuntime,
  type P2PPublishInput,
  type P2PPublishResult,
} from '../src/lib/sync-runtime.js';

/**
 * p2p-events.ts is thin glue between the route handlers and the runtime,
 * but "thin" is where a silent data leak usually hides. These tests pin the
 * contract for each call path:
 *
 *   - logP2PPublishResult fires at error level when the durable append fails
 *     (so an operator wakes up to a data-loss incident instead of finding a
 *     warning two days later).
 *   - logP2PFanoutResult fires at warn when the durable append succeeded
 *     but live fanout failed (recoverable on next /sync).
 *   - fanoutSyncEvents continues iterating even if one per-event fanout
 *     throws — a single bad socket must not starve every remaining event.
 *   - post.tombstoned and announcement.deleted set redactPriorPayloads so
 *     the runtime atomically scrubs the prior rows.
 */

function createLogger() {
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
    level: 'error',
    silent: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

function createMetrics() {
  return {
    p2pSyncErrorsTotal: { inc: vi.fn() },
    p2pSyncEventsTotal: { inc: vi.fn() },
    p2pSyncLagSeconds: { observe: vi.fn() },
    p2pActiveConnections: { inc: vi.fn(), dec: vi.fn() },
    p2pBootstrapTotal: { inc: vi.fn() },
  };
}

function createAppStub(options: {
  runtime?: Partial<InMemoryP2PSyncRuntime> & {
    publish?: (input: P2PPublishInput) => Promise<P2PPublishResult>;
    fanout?: (event: CommunitySyncEvent) => Promise<boolean>;
  };
} = {}) {
  const logger = createLogger();
  const metrics = createMetrics();
  const runtime = options.runtime ?? new InMemoryP2PSyncRuntime();
  const app = {
    log: logger,
    metrics,
    syncRuntime: runtime,
  } as unknown as FastifyInstance;
  return { app, logger, metrics };
}

const communityId = '44444444-4444-4444-8444-444444444444';
const postId = '11111111-1111-4111-8111-111111111111';
const announcementId = '22222222-2222-4222-8222-222222222222';
const actorUserId = '77777777-7777-4777-8777-777777777777';

describe('p2p-events.ts', () => {
  describe('logP2PPublishResult (via publishPostEvent)', () => {
    it('logs at error level when the durable append fails', async () => {
      const failingRuntime: Pick<InMemoryP2PSyncRuntime, 'publish'> = {
        publish: vi.fn(async (input: P2PPublishInput): Promise<P2PPublishResult> => ({
          event: {
            sync_event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            community_id: input.communityId,
            topic: `weavenyc/${input.communityId}/posts`,
            event_type: 'post.published',
            aggregate_type: 'post',
            aggregate_id: input.aggregateId,
            occurred_at: new Date().toISOString(),
            cid: 'cid',
            actor_p2p_id: null,
            payload: { post: { post_id: input.aggregateId } },
          } as CommunitySyncEvent,
          durablePublished: false, // <-- the interesting path
          livePublished: false,
        })),
      };
      const { app, logger } = createAppStub({ runtime: failingRuntime as unknown as InMemoryP2PSyncRuntime });

      await publishPostEvent(app, {
        eventType: 'post.published',
        post: {
          post_id: postId,
          community_id: communityId,
          updated_at: new Date().toISOString(),
        } as unknown as Parameters<typeof publishPostEvent>[1]['post'],
        actorUserId,
      });

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          postId,
          eventType: 'post.published',
          syncEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        }),
        expect.stringContaining('durably'),
      );
    });

    it('logs at warn when durable succeeded but live fanout failed', async () => {
      const partialRuntime: Pick<InMemoryP2PSyncRuntime, 'publish'> = {
        publish: vi.fn(async (input: P2PPublishInput): Promise<P2PPublishResult> => ({
          event: {
            sync_event_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            community_id: input.communityId,
            topic: `weavenyc/${input.communityId}/posts`,
            event_type: 'post.published',
            aggregate_type: 'post',
            aggregate_id: input.aggregateId,
            occurred_at: new Date().toISOString(),
            cid: 'cid',
            actor_p2p_id: null,
            payload: { post: { post_id: input.aggregateId } },
          } as CommunitySyncEvent,
          durablePublished: true,
          livePublished: false,
        })),
      };
      const { app, logger } = createAppStub({ runtime: partialRuntime as unknown as InMemoryP2PSyncRuntime });

      await publishPostEvent(app, {
        eventType: 'post.published',
        post: {
          post_id: postId,
          community_id: communityId,
          updated_at: new Date().toISOString(),
        } as unknown as Parameters<typeof publishPostEvent>[1]['post'],
        actorUserId,
      });

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishPostEvent / publishAnnouncementEvent', () => {
    it('forwards redactPriorPayloads=true for post.tombstoned', async () => {
      const publishSpy = vi.fn(
        async (input: P2PPublishInput): Promise<P2PPublishResult> => ({
          event: {
            sync_event_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            community_id: input.communityId,
            topic: `weavenyc/${input.communityId}/posts`,
            event_type: input.eventType,
            aggregate_type: input.aggregateType,
            aggregate_id: input.aggregateId,
            occurred_at: new Date().toISOString(),
            cid: 'cid',
            actor_p2p_id: null,
            payload: { post: { post_id: input.aggregateId } },
          } as CommunitySyncEvent,
          durablePublished: true,
          livePublished: true,
        }),
      );
      const runtime = { publish: publishSpy } as unknown as InMemoryP2PSyncRuntime;
      const { app } = createAppStub({ runtime });

      await publishPostEvent(app, {
        eventType: 'post.tombstoned',
        post: {
          post_id: postId,
          community_id: communityId,
          updated_at: new Date().toISOString(),
        } as unknown as Parameters<typeof publishPostEvent>[1]['post'],
        actorUserId,
      });

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'post.tombstoned', redactPriorPayloads: true }),
      );
    });

    it('does NOT set redactPriorPayloads for post.published', async () => {
      const publishSpy = vi.fn(
        async (input: P2PPublishInput): Promise<P2PPublishResult> => ({
          event: {
            sync_event_id: 'cccccccc-cccc-4ccc-8ccc-000000000001',
            community_id: input.communityId,
            topic: `weavenyc/${input.communityId}/posts`,
            event_type: input.eventType,
            aggregate_type: input.aggregateType,
            aggregate_id: input.aggregateId,
            occurred_at: new Date().toISOString(),
            cid: 'cid',
            actor_p2p_id: null,
            payload: { post: { post_id: input.aggregateId } },
          } as CommunitySyncEvent,
          durablePublished: true,
          livePublished: true,
        }),
      );
      const runtime = { publish: publishSpy } as unknown as InMemoryP2PSyncRuntime;
      const { app } = createAppStub({ runtime });

      await publishPostEvent(app, {
        eventType: 'post.published',
        post: {
          post_id: postId,
          community_id: communityId,
          updated_at: new Date().toISOString(),
        } as unknown as Parameters<typeof publishPostEvent>[1]['post'],
        actorUserId,
      });

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'post.published', redactPriorPayloads: false }),
      );
    });

    it('forwards redactPriorPayloads=true for announcement.deleted', async () => {
      const publishSpy = vi.fn(
        async (input: P2PPublishInput): Promise<P2PPublishResult> => ({
          event: {
            sync_event_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            community_id: input.communityId,
            topic: `weavenyc/${input.communityId}/announcements`,
            event_type: input.eventType,
            aggregate_type: input.aggregateType,
            aggregate_id: input.aggregateId,
            occurred_at: new Date().toISOString(),
            cid: 'cid',
            actor_p2p_id: null,
            payload: { announcement: { announcement_id: input.aggregateId } },
          } as CommunitySyncEvent,
          durablePublished: true,
          livePublished: true,
        }),
      );
      const runtime = { publish: publishSpy } as unknown as InMemoryP2PSyncRuntime;
      const { app } = createAppStub({ runtime });

      await publishAnnouncementEvent(app, {
        eventType: 'announcement.deleted',
        announcement: {
          announcement_id: announcementId,
          community_id: communityId,
          updated_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
        } as unknown as Parameters<typeof publishAnnouncementEvent>[1]['announcement'],
      });

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'announcement.deleted', redactPriorPayloads: true }),
      );
    });
  });

  describe('post.tombstoned redaction through the in-memory runtime', () => {
    it('redacts prior post.published and post.updated payloads for the same aggregate', async () => {
      const runtime = new InMemoryP2PSyncRuntime();
      const { app } = createAppStub({ runtime });
      const now = new Date();
      const earlier = new Date(now.getTime() - 5_000);
      const evenEarlier = new Date(now.getTime() - 10_000);

      // Publish original + update so there's something to redact.
      await publishPostEvent(app, {
        eventType: 'post.published',
        post: {
          post_id: postId,
          community_id: communityId,
          title: 'sensitive title',
          body: 'sensitive body',
          updated_at: evenEarlier.toISOString(),
        } as unknown as Parameters<typeof publishPostEvent>[1]['post'],
        actorUserId,
      });
      await publishPostEvent(app, {
        eventType: 'post.updated',
        post: {
          post_id: postId,
          community_id: communityId,
          title: 'still sensitive',
          body: 'still sensitive',
          updated_at: earlier.toISOString(),
        } as unknown as Parameters<typeof publishPostEvent>[1]['post'],
        actorUserId,
      });

      // Verify plaintext lands before tombstone.
      let storedEvents = await runtime.listEvents(communityId, null, 100);
      const beforePublished = storedEvents.find((evt) => evt.event_type === 'post.published');
      expect((beforePublished?.payload as { post: { title?: string } }).post.title).toBe(
        'sensitive title',
      );

      // Tombstone with redaction.
      await publishPostEvent(app, {
        eventType: 'post.tombstoned',
        post: {
          post_id: postId,
          community_id: communityId,
          updated_at: now.toISOString(),
        } as unknown as Parameters<typeof publishPostEvent>[1]['post'],
        actorUserId,
      });

      storedEvents = await runtime.listEvents(communityId, null, 100);
      const afterPublished = storedEvents.find((evt) => evt.event_type === 'post.published');
      const afterUpdated = storedEvents.find((evt) => evt.event_type === 'post.updated');
      const tombstone = storedEvents.find((evt) => evt.event_type === 'post.tombstoned');

      expect(tombstone).toBeDefined();
      expect(afterPublished?.payload).toEqual({
        post: { post_id: postId },
        redacted: true,
      });
      expect(afterUpdated?.payload).toEqual({
        post: { post_id: postId },
        redacted: true,
      });
    });

    it('redacts prior announcement.published and announcement.updated for announcement.deleted', async () => {
      const runtime = new InMemoryP2PSyncRuntime();
      const { app } = createAppStub({ runtime });
      const now = new Date();
      const earlier = new Date(now.getTime() - 5_000);

      await publishAnnouncementEvent(app, {
        eventType: 'announcement.published',
        announcement: {
          announcement_id: announcementId,
          community_id: communityId,
          title: 'sensitive announcement title',
          body: 'sensitive body',
          updated_at: earlier.toISOString(),
          published_at: earlier.toISOString(),
        } as unknown as Parameters<typeof publishAnnouncementEvent>[1]['announcement'],
      });

      await publishAnnouncementEvent(app, {
        eventType: 'announcement.deleted',
        announcement: {
          announcement_id: announcementId,
          community_id: communityId,
          updated_at: now.toISOString(),
          published_at: now.toISOString(),
        } as unknown as Parameters<typeof publishAnnouncementEvent>[1]['announcement'],
      });

      const events = await runtime.listEvents(communityId, null, 100);
      const published = events.find((evt) => evt.event_type === 'announcement.published');
      const deleted = events.find((evt) => evt.event_type === 'announcement.deleted');

      expect(deleted).toBeDefined();
      expect(published?.payload).toEqual({
        announcement: { announcement_id: announcementId },
        redacted: true,
      });
    });
  });

  describe('fanoutSyncEvents', () => {
    it('continues iterating after a per-event fanout throws', async () => {
      const events: CommunitySyncEvent[] = [
        {
          sync_event_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
          community_id: communityId,
          topic: `weavenyc/${communityId}/posts`,
          event_type: 'post.published',
          aggregate_type: 'post',
          aggregate_id: postId,
          occurred_at: new Date().toISOString(),
          cid: 'cid-1',
          actor_p2p_id: null,
          payload: { post: { post_id: postId } },
        } as CommunitySyncEvent,
        {
          sync_event_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
          community_id: communityId,
          topic: `weavenyc/${communityId}/posts`,
          event_type: 'post.updated',
          aggregate_type: 'post',
          aggregate_id: postId,
          occurred_at: new Date().toISOString(),
          cid: 'cid-2',
          actor_p2p_id: null,
          payload: { post: { post_id: postId } },
        } as CommunitySyncEvent,
        {
          sync_event_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',
          community_id: communityId,
          topic: `weavenyc/${communityId}/posts`,
          event_type: 'post.tombstoned',
          aggregate_type: 'post',
          aggregate_id: postId,
          occurred_at: new Date().toISOString(),
          cid: 'cid-3',
          actor_p2p_id: null,
          payload: { post: { post_id: postId }, redacted: true },
        } as CommunitySyncEvent,
      ];

      const fanoutSpy = vi.fn(async (event: CommunitySyncEvent) => {
        if (event.sync_event_id.endsWith('eee2')) {
          throw new Error('simulated broken socket');
        }
        return true;
      });

      const runtime = { fanout: fanoutSpy } as unknown as InMemoryP2PSyncRuntime;
      const { app, logger, metrics } = createAppStub({ runtime });

      await fanoutSyncEvents(app, events, { postId });

      // All 3 events were attempted, even though #2 threw.
      expect(fanoutSpy).toHaveBeenCalledTimes(3);

      // The error was logged, but execution continued.
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error), syncEventId: expect.stringContaining('eee2') }),
        expect.any(String),
      );
      expect(metrics.p2pSyncErrorsTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({ op: 'fanout', kind: 'runtime' }),
      );
    });

    it('no-ops cleanly when passed undefined', async () => {
      const runtime = { fanout: vi.fn() } as unknown as InMemoryP2PSyncRuntime;
      const { app } = createAppStub({ runtime });
      await expect(fanoutSyncEvents(app, undefined, {})).resolves.toBeUndefined();
    });
  });
});
