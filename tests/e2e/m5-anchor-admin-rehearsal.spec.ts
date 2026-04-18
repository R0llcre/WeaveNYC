import { expect, test } from '@playwright/test';

const adminBaseUrl = 'http://127.0.0.1:3001';
const communityId = '44444444-4444-4444-8444-444444444444';
const verifiedUserId = '22222222-2222-4222-8222-222222222222';
const anchorUserId = '33333333-3333-4333-8333-333333333333';
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function fakeJwt(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
}

function orderAnnouncements(
  rules: { announcement_pin_strategy: 'latest' | 'manual' },
  items: Array<{
    status: string;
    is_pinned: boolean;
    published_at: string;
    announcement_id: string;
  }>,
) {
  const activeItems = items.filter((item) => item.status === 'active');
  return [...activeItems].sort((left, right) => {
    if (rules.announcement_pin_strategy === 'manual') {
      const pinnedDelta = Number(right.is_pinned) - Number(left.is_pinned);
      if (pinnedDelta !== 0) {
        return pinnedDelta;
      }
    }

    const publishedDelta = new Date(right.published_at).getTime() - new Date(left.published_at).getTime();
    if (publishedDelta !== 0) {
      return publishedDelta;
    }

    return right.announcement_id.localeCompare(left.announcement_id);
  });
}

test('anchor login -> activate -> review -> announcements -> rules -> pwa banner rehearsal', async ({
  context,
  page,
}) => {
  const now = new Date().toISOString();
  let rules = {
    community_id: communityId,
    review_categories: ['childcare', 'transportation'],
    auto_hide_report_threshold: 3,
    keyword_blocklist: [],
    language_preferences: ['en', 'es'],
    announcement_pin_strategy: 'latest',
    updated_at: now,
  };
  let announcements = [
    {
      announcement_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      community_id: communityId,
      title: 'Pantry schedule update',
      body: 'Pantry opens one hour early tomorrow.',
      status: 'active',
      is_pinned: true,
      created_by: anchorUserId,
      published_at: now,
      updated_at: now,
    },
  ];
  let pendingPosts = [
    {
      post_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      community_id: communityId,
      post_type: 'offer',
      category: 'transportation',
      title: 'Can drive someone to the pantry',
      body: 'Needs moderation review.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      status: 'pending_review',
      risk_level: 'high',
      created_at: now,
      updated_at: now,
      expires_at: now,
      is_owner: false,
      review_actions: ['approve', 'reject', 'request_more_info'],
    },
  ];
  let pendingReports = [
    {
      report_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      community_id: communityId,
      target_type: 'post',
      target_id: pendingPosts[0].post_id,
      reason: 'unsafe_behavior',
      status: 'new',
      created_at: now,
      reporter_user_id: verifiedUserId,
      reporter_alias: 'Verified Demo User',
      priority: 'P0',
      conversation_id: null,
      target_summary: {
        title: pendingPosts[0].title,
        body_preview: pendingPosts[0].body,
        related_user_id: verifiedUserId,
      },
      evidence_description: 'Needs moderation review',
    },
  ];

  await context.route('http://localhost:4000/**', async (route) => {
    if (route.request().method() !== 'OPTIONS') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 204,
      headers: corsHeaders,
    });
  });

  const anonymousSession = {
    access_token: fakeJwt({ sub: verifiedUserId, level: 'anonymous', role: 'user', community_ids: [] }),
    refresh_token: 'rt-anonymous',
    user: {
      user_id: verifiedUserId,
      level: 'anonymous',
    },
    issued_via: 'anonymous',
  };
  const verifiedSession = {
    access_token: fakeJwt({ sub: verifiedUserId, level: 'verified', role: 'user', community_ids: [communityId] }),
    refresh_token: 'rt-verified',
    user: {
      user_id: verifiedUserId,
      level: 'verified',
    },
    issued_via: 'otp',
  };
  const anchorSession = {
    access_token: fakeJwt({
      sub: anchorUserId,
      level: 'anchor',
      role: 'anchor',
      community_ids: [communityId],
      anchor_community_id: communityId,
      mfa_verified_at: now,
    }),
    refresh_token: 'rt-anchor',
    user: {
      user_id: anchorUserId,
      level: 'anchor',
    },
    issued_via: 'anchor_activate',
  };
  let refreshSession = verifiedSession;

  await context.route('**/healthz', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'ok',
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
      }),
    });
  });

  await context.route('**/readyz', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'ok',
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
      }),
    });
  });

  await context.route('**/v1/auth/anonymous', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(anonymousSession),
    });
  });

  await context.route('**/v1/auth/otp/start', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        challenge_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        masked_destination: '(***) ***-0101',
        delivery_channel: 'sms',
        expires_in_seconds: 600,
        fallback: true,
        demo_code: '246810',
      }),
    });
  });

  await context.route('**/v1/auth/otp/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(verifiedSession),
    });
  });

  await context.route('**/v1/auth/anchor/activate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        activation_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        community: {
          community_id: communityId,
          name: 'Farmingdale Demo Community',
          center_zip: '11735',
          join_policy: 'invite_only',
        },
        otpauth_uri: 'otpauth://totp/WeaveNYC%20Anchor:demo?secret=JBSWY3DPEHPK3PXP&issuer=WeaveNYC%20Anchor',
        recovery_codes: [
          'ABCD-1111',
          'BCDE-2222',
          'CDEF-3333',
          'DEFG-4444',
          'EFGH-5555',
          'FGHI-6666',
          'GHIJ-7777',
          'HIJK-8888',
        ],
        expires_in_seconds: 600,
      }),
    });
  });

  await context.route('**/v1/auth/anchor/activate/confirm', async (route) => {
    refreshSession = anchorSession;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(anchorSession),
    });
  });

  await context.route('**/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(refreshSession),
    });
  });

  await context.route('**/v1/admin/communities/*/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        community_id: communityId,
        posts_this_week_request_count: 4,
        posts_this_week_offer_count: 3,
        accepted_contacts_this_week_count: 2,
        reports_this_week_count: pendingReports.length,
        pending_post_review_count: pendingPosts.length,
        pending_report_count: pendingReports.length,
      }),
    });
  });

  await context.route('**/v1/admin/review_queue?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        items: pendingPosts,
        next_cursor: null,
      }),
    });
  });

  await context.route('**/v1/admin/review_queue/*/decision', async (route) => {
    const url = new URL(route.request().url());
    const postId = url.pathname.split('/').slice(-2)[0];
    pendingPosts = pendingPosts.filter((item) => item.post_id !== postId);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        post_id: postId,
        status: 'active',
        decided_at: new Date().toISOString(),
      }),
    });
  });

  await context.route('**/v1/admin/report_queue?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        items: pendingReports,
        next_cursor: null,
      }),
    });
  });

  await context.route('**/v1/admin/report_queue/*/decision', async (route) => {
    const url = new URL(route.request().url());
    const reportId = url.pathname.split('/').slice(-2)[0];
    pendingReports = pendingReports.filter((item) => item.report_id !== reportId);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        report_id: reportId,
        status: 'resolved',
        resolution: 'remove_post',
        decided_at: new Date().toISOString(),
      }),
    });
  });

  await context.route('**/v1/admin/communities/*/rules', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(rules),
      });
      return;
    }

    const body = route.request().postDataJSON() as typeof rules;
    rules = {
      ...rules,
      ...body,
      updated_at: new Date().toISOString(),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(rules),
    });
  });

  await context.route('**/v1/admin/communities/*/announcements', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ items: announcements }),
      });
      return;
    }

    const body = route.request().postDataJSON() as { title: string; body: string; is_pinned?: boolean };
    const created = {
      announcement_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      community_id: communityId,
      title: body.title,
      body: body.body,
      status: 'active',
      is_pinned: Boolean(body.is_pinned),
      created_by: anchorUserId,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    announcements = [created, ...announcements];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(created),
    });
  });

  await context.route('**/v1/admin/communities/*/announcements/*', async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const announcementId = url.pathname.split('/').at(-1)!;

    if (method === 'PATCH') {
      const body = route.request().postDataJSON() as { title?: string; body?: string; is_pinned?: boolean };
      announcements = announcements.map((item) =>
        item.announcement_id === announcementId
          ? {
              ...item,
              title: body.title ?? item.title,
              body: body.body ?? item.body,
              is_pinned: typeof body.is_pinned === 'boolean' ? body.is_pinned : item.is_pinned,
              updated_at: new Date().toISOString(),
            }
          : item,
      );
      const updated = announcements.find((item) => item.announcement_id === announcementId)!;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(updated),
      });
      return;
    }

    announcements = announcements.map((item) =>
      item.announcement_id === announcementId
        ? { ...item, status: 'deleted', updated_at: new Date().toISOString() }
        : item,
    );
    const deleted = announcements.find((item) => item.announcement_id === announcementId)!;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(deleted),
    });
  });

  await context.route('**/v1/community-access/resolve', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        community: {
          community_id: communityId,
          name: 'Farmingdale Demo Community',
          center_zip: '11735',
          join_policy: 'invite_only',
        },
        join_token: 'join-token',
        entry: 'invite_code',
        expires_in_seconds: 600,
      }),
    });
  });

  await context.route(`**/v1/communities/${communityId}/join`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        community_id: communityId,
        membership_status: 'joined',
        joined_at: new Date().toISOString(),
      }),
    });
  });

  await context.route(`**/v1/communities/${communityId}/announcements`, async (route) => {
    const activeAnnouncements = orderAnnouncements(rules, announcements);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ items: activeAnnouncements }),
    });
  });

  await context.route('**/v1/posts?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        items: [],
        next_cursor: null,
      }),
    });
  });

  await context.route('**/v1/contact-requests/inbox**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        items: [],
        next_cursor: null,
      }),
    });
  });

  await page.goto(`${adminBaseUrl}/login`);
  await page.getByLabel('Phone number').fill('+15155550101');
  await page.getByRole('button', { name: 'Start OTP' }).click();
  await expect(page.getByText('OTP challenge created')).toBeVisible();
  await page.getByLabel('OTP code').fill('246810');
  await page.getByRole('button', { name: 'Verify OTP' }).click();
  await expect(page.getByText('Verified session loaded.')).toBeVisible();
  await page.getByRole('link', { name: 'Continue to activation' }).click();
  await expect(page).toHaveURL(`${adminBaseUrl}/activate`);

  await page.getByLabel('Invite code').fill('ANCHOR-DEMO-INVITE');
  await page.getByRole('button', { name: 'Start activation' }).click();
  await expect(page.getByText('Enrollment ready for Farmingdale Demo Community.')).toBeVisible();
  await page.getByLabel('TOTP code').fill('123456');
  await page.getByRole('button', { name: 'Confirm activation' }).click();
  await expect(page).toHaveURL(`${adminBaseUrl}/`);
  await expect(page.getByText('Request posts this week')).toBeVisible();
  await expect(page.getByText('Pending report reviews')).toBeVisible();

  await page.getByRole('link', { name: 'Open review queue' }).click();
  await expect(page).toHaveURL(`${adminBaseUrl}/review`);
  await expect(page.getByText('Can drive someone to the pantry')).toBeVisible();
  await page.getByRole('button', { name: 'Reports' }).click();
  await expect(page.getByText('Needs moderation review')).toBeVisible();
  await page.getByRole('button', { name: 'Remove post' }).click();
  await expect(page.getByText('No reports are currently waiting in the review queue.')).toBeVisible();

  await page.getByRole('banner').getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('link', { name: 'Manage announcements' }).click();
  await expect(page).toHaveURL(`${adminBaseUrl}/announcements`);
  await page.getByLabel('Title').fill('New pilot rehearsal announcement');
  await page.getByLabel('Body').fill('Bring ID and arrive 15 minutes early.');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('New pilot rehearsal announcement')).toBeVisible();

  await page.getByRole('link', { name: 'Open rules' }).click();
  await expect(page).toHaveURL(`${adminBaseUrl}/rules`);
  await page.getByLabel('Review categories').fill('goods, transportation');
  await page.locator('input[inputmode="numeric"]').fill('2');
  await page.getByLabel('Announcement pin strategy').selectOption('manual');
  await page.getByRole('button', { name: 'Save rules' }).click();
  await expect(page.getByText('goods, transportation')).toBeVisible();
  await expect(page.locator('.badge').filter({ hasText: 'manual' })).toBeVisible();

  const pwaPage = await context.newPage();
  await pwaPage.goto('/community');
  await pwaPage.getByTestId('create-session').click();
  await pwaPage.goto('/community/join');
  await pwaPage.getByTestId('join-mode-invite').click();
  await pwaPage.getByLabel(/invite code/i).fill('FARMINGDALE-HELP');
  await pwaPage.getByTestId('resolve-community').click();
  await pwaPage.getByTestId('confirm-join').click();
  await expect(pwaPage).toHaveURL(/\/community\/$/);
  const banner = pwaPage.locator('.announcement-banner');
  const announcementList = pwaPage.locator('.announcement-list');
  await expect(banner).toContainText('Pantry schedule update');
  await expect(banner).toContainText('Pinned');
  await expect(banner).not.toContainText('New pilot rehearsal announcement');
  await expect(announcementList).toContainText('New pilot rehearsal announcement');
  await expect(announcementList).toContainText('Bring ID and arrive 15 minutes early.');
});
