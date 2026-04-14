import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestInternalJson } = vi.hoisted(() => ({
  requestInternalJson: vi.fn(),
}));

vi.mock('../src/lib/internal-service-client.js', () => ({
  InternalServiceError: class InternalServiceError extends Error {
    constructor(message: string, readonly statusCode = 502, readonly responseBody?: unknown) {
      super(message);
      this.name = 'InternalServiceError';
    }
  },
  requestInternalJson,
}));

import { createHttpChatService, createHttpPostsService } from '../src/lib/http-domain-services.js';

const context = {
  config: {},
  serviceJwt: {
    sign: () => 'internal-token',
  },
} as never;

const userActor = {
  userId: 'user-1',
  level: 'verified' as const,
  role: 'user' as const,
  communityIds: ['community-1'],
  anchorCommunityId: null,
  mfaVerifiedAt: undefined,
};

const anchorActor = {
  userId: 'anchor-1',
  level: 'anchor' as const,
  role: 'anchor' as const,
  communityIds: ['community-1'],
  anchorCommunityId: 'community-1',
  mfaVerifiedAt: '2026-04-14T00:00:00.000Z',
};

describe('HTTP domain service bridges', () => {
  beforeEach(() => {
    requestInternalJson.mockReset();
    requestInternalJson.mockResolvedValue({});
  });

  it('sends snake_case payloads for posts internal routes that require ids', async () => {
    const service = createHttpPostsService(context);

    await service.joinCommunity({ userId: 'user-1', communityId: 'community-1' });
    await service.getPostDetail(userActor, 'post-1');
    await service.updatePost({
      actor: userActor,
      postId: 'post-2',
      request: { title: 'Updated title' },
    });
    await service.closePost(userActor, 'post-3');
    await service.removePost(userActor, 'post-4');

    expect(requestInternalJson).toHaveBeenNthCalledWith(
      1,
      context,
      'posts',
      expect.objectContaining({
        path: '/internal/v1/posts/join-community',
        body: { community_id: 'community-1' },
      }),
    );
    expect(requestInternalJson).toHaveBeenNthCalledWith(
      2,
      context,
      'posts',
      expect.objectContaining({
        path: '/internal/v1/posts/get-post-detail',
        body: { post_id: 'post-1' },
      }),
    );
    expect(requestInternalJson).toHaveBeenNthCalledWith(
      3,
      context,
      'posts',
      expect.objectContaining({
        path: '/internal/v1/posts/update-post',
        body: { post_id: 'post-2', request: { title: 'Updated title' } },
      }),
    );
    expect(requestInternalJson).toHaveBeenNthCalledWith(
      4,
      context,
      'posts',
      expect.objectContaining({
        path: '/internal/v1/posts/close-post',
        body: { post_id: 'post-3' },
      }),
    );
    expect(requestInternalJson).toHaveBeenNthCalledWith(
      5,
      context,
      'posts',
      expect.objectContaining({
        path: '/internal/v1/posts/remove-post',
        body: { post_id: 'post-4' },
      }),
    );
  });

  it('sends snake_case payloads for chat moderation internal routes', async () => {
    const service = createHttpChatService(context);

    await service.listReportQueue({
      actor: anchorActor,
      communityId: 'community-1',
      status: 'new',
      cursor: 'cursor-1',
      limit: 10,
    });
    await service.decideReport({
      actor: anchorActor,
      communityId: 'community-1',
      reportId: 'report-1',
      decision: 'dismiss',
      notes: 'resolved',
    });

    expect(requestInternalJson).toHaveBeenNthCalledWith(
      1,
      context,
      'chat',
      expect.objectContaining({
        path: '/internal/v1/chat/list-report-queue',
        body: {
          community_id: 'community-1',
          status: 'new',
          cursor: 'cursor-1',
          limit: 10,
        },
      }),
    );
    expect(requestInternalJson).toHaveBeenNthCalledWith(
      2,
      context,
      'chat',
      expect.objectContaining({
        path: '/internal/v1/chat/decide-report',
        body: {
          community_id: 'community-1',
          report_id: 'report-1',
          decision: 'dismiss',
          notes: 'resolved',
        },
      }),
    );
  });
});
