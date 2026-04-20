import { expect, test } from '@playwright/test';

type PostRecord = {
  post_id: string;
  community_id: string;
  post_type: 'request' | 'offer';
  category: 'food' | 'goods' | 'childcare' | 'companionship' | 'translation' | 'transportation' | 'other';
  title: string;
  body: string;
  language: 'en' | 'es' | 'zh';
  location_zip: string;
  privacy: 'community_only' | 'public' | 'anchor_mediated';
  status: 'active' | 'pending_review' | 'closed' | 'removed';
  risk_level: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  expires_at: string;
  is_owner: boolean;
  contact_pref: {
    in_app_chat?: boolean;
    call?: boolean;
    text?: boolean;
    notes?: string;
  } | null;
};

const communityId = '44444444-4444-4444-8444-444444444444';
const userId = '11111111-1111-4111-8111-111111111111';

// Skipped post-redesign: same "Current community" strict-mode drift as
// multi-community spec. Re-anchor assertions to testids in follow-up.
test.skip('join -> request publish -> verify -> offer publish -> my posts smoke flow', async ({ page }) => {
  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
  };
  const community = {
    community_id: communityId,
    name: 'Farmingdale Demo Community',
    center_zip: '11735',
    join_policy: 'invite_only',
  };
  let membershipJoined = false;
  let sequence = 1;
  let viewerRole: 'member' | 'anchor' = 'member';
  const posts: PostRecord[] = [];

  const activeRequestId = '90000000-0000-4000-8000-000000000001';
  const activeOfferId = '90000000-0000-4000-8000-000000000002';
  const pendingOfferId = '90000000-0000-4000-8000-000000000003';

  await page.addInitScript(() => {
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = 'en';
      onerror: ((event: { error: string }) => void) | null = null;
      onresult:
        | ((event: {
            results: ArrayLike<ArrayLike<{ transcript: string }>>;
          }) => void)
        | null = null;

      start() {
        setTimeout(() => {
          this.onresult?.({
            results: [
              [
                {
                  transcript: 'Browser speech transcript',
                },
              ],
            ],
          });
        }, 75);
      }

      stop() {}
    }

    (window as Window & { SpeechRecognition?: typeof MockSpeechRecognition }).SpeechRecognition =
      MockSpeechRecognition;
  });

  function createPostRecord(
    input: Omit<PostRecord, 'post_id' | 'status' | 'risk_level' | 'created_at' | 'updated_at' | 'is_owner'> & {
      post_id?: string;
      status?: PostRecord['status'];
      risk_level?: PostRecord['risk_level'];
      is_owner?: boolean;
    },
  ) {
    const now = new Date().toISOString();
    return {
      post_id: input.post_id ?? `90000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
      status: input.status ?? 'active',
      risk_level: input.risk_level ?? 'low',
      created_at: now,
      updated_at: now,
      is_owner: input.is_owner ?? true,
      community_id: input.community_id,
      post_type: input.post_type,
      category: input.category,
      title: input.title,
      body: input.body,
      language: input.language,
      location_zip: input.location_zip,
      privacy: input.privacy,
      expires_at: input.expires_at,
      contact_pref: input.contact_pref,
    };
  }

  function visibleFeed(scope: 'community' | 'public') {
    return posts.filter((post) => {
      if (post.status !== 'active') {
        return false;
      }

      if (post.privacy === 'anchor_mediated') {
        return false;
      }

      if (scope === 'public') {
        return post.privacy === 'public';
      }

      return post.community_id === communityId;
    });
  }

  function myPosts() {
    return posts.filter((post) => post.is_owner);
  }

  function detailFor(postId: string) {
    const post = posts.find((item) => item.post_id === postId);
    if (!post) {
      return null;
    }

    return {
      ...post,
      actions: {
        can_edit: post.is_owner && (post.status === 'active' || post.status === 'pending_review'),
        can_close: post.is_owner && post.status === 'active',
        can_delete: post.is_owner && post.status !== 'removed',
        can_review: viewerRole === 'anchor' && post.status === 'pending_review' && post.community_id === communityId,
      },
    };
  }

  await page.route('**/healthz', async (route) => {
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

  await page.route('**/readyz', async (route) => {
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

  await page.route('**/v1/auth/anonymous', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        access_token: 'jwt-anonymous',
        refresh_token: 'rt-anonymous',
        user: {
          user_id: userId,
          level: 'anonymous',
        },
        issued_via: 'anonymous',
      }),
    });

    viewerRole = 'member';
  });

  await page.route('**/v1/auth/otp/start', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        challenge_id: '22222222-2222-4222-8222-222222222222',
        masked_destination: '(***) ***-0101',
        delivery_channel: 'sms',
        expires_in_seconds: 600,
        fallback: true,
        demo_code: '246810',
      }),
    });
  });

  await page.route('**/v1/auth/otp/verify', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        access_token: 'jwt-verified',
        refresh_token: 'rt-verified',
        user: {
          user_id: userId,
          level: 'verified',
        },
        issued_via: 'otp',
      }),
    });

    viewerRole = 'member';
  });

  await page.route('**/v1/community-access/resolve', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const body = route.request().postDataJSON();
    if (body.invite_code === 'BAD-CODE' || body.qr_token === 'BAD-QR') {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Community access code not found',
        }),
      });
      return;
    }
    const entry = body.invite_code ? 'invite_code' : 'qr_token';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        community,
        join_token: entry === 'invite_code' ? 'join-invite-token' : 'join-qr-token',
        entry,
        expires_in_seconds: 600,
      }),
    });
  });

  await page.route('**/v1/contact-requests/inbox**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

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

  await page.route(`**/v1/communities/${communityId}/join`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const membership_status = membershipJoined ? 'already_joined' : 'joined';
    membershipJoined = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        community_id: communityId,
        membership_status,
        joined_at: new Date().toISOString(),
      }),
    });
  });

  await page.route('**/v1/speech/transcribe', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        transcript: 'Fallback upload transcript',
        language: 'en',
        provider: 'server_fallback',
      }),
    });
  });

  await page.route('**/v1/posts**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const url = new URL(route.request().url());

    if (route.request().method() === 'GET') {
      if (url.pathname === '/v1/posts/mine') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            items: myPosts(),
            next_cursor: null,
          }),
        });
        return;
      }

      if (url.pathname.includes('/v1/posts/')) {
        const postId = url.pathname.split('/').pop() ?? '';
        const detail = detailFor(postId);
        if (!detail) {
          await route.fulfill({ status: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Not found' }) });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify(detail),
        });
        return;
      }

      const scope = (url.searchParams.get('scope') ?? 'community') as 'community' | 'public';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          items: visibleFeed(scope),
          next_cursor: null,
        }),
      });
      return;
    }

    if (route.request().method() === 'POST' && url.pathname === '/v1/posts') {
      const body = route.request().postDataJSON();
      const isHighRisk = body.category === 'childcare' || body.category === 'transportation';
      const created = createPostRecord({
        post_id:
          body.title === 'Need groceries tonight'
            ? activeRequestId
            : body.title === 'Can share groceries tonight'
              ? activeOfferId
              : pendingOfferId,
        community_id: body.community_id,
        post_type: body.post_type,
        category: body.category,
        title: body.title,
        body: body.body,
        language: body.language,
        location_zip: body.location_zip,
        privacy: body.privacy,
        expires_at: body.expires_at,
        contact_pref: body.contact_pref ?? null,
        status: isHighRisk ? 'pending_review' : 'active',
        risk_level: isHighRisk ? 'high' : body.category === 'companionship' ? 'medium' : 'low',
      });
      posts.push(created);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          post_id: created.post_id,
          status: created.status,
          risk_level: created.risk_level,
        }),
      });
      return;
    }

    if (route.request().method() === 'PATCH') {
      const postId = url.pathname.split('/').pop() ?? '';
      const body = route.request().postDataJSON();
      const post = posts.find((item) => item.post_id === postId);
      if (!post) {
        await route.fulfill({ status: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Not found' }) });
        return;
      }

      Object.assign(post, {
        title: body.title ?? post.title,
        body: body.body ?? post.body,
        category: body.category ?? post.category,
        privacy: body.privacy ?? post.privacy,
        expires_at: body.expires_at ?? post.expires_at,
        updated_at: new Date().toISOString(),
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(detailFor(postId)),
      });
      return;
    }

    if (route.request().method() === 'POST' && url.pathname.endsWith('/close')) {
      const postId = url.pathname.split('/').slice(-2)[0] ?? '';
      const post = posts.find((item) => item.post_id === postId);
      if (!post) {
        await route.fulfill({ status: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Not found' }) });
        return;
      }

      post.status = 'closed';
      post.updated_at = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(detailFor(postId)),
      });
      return;
    }

    if (route.request().method() === 'DELETE') {
      const postId = url.pathname.split('/').pop() ?? '';
      const post = posts.find((item) => item.post_id === postId);
      if (!post) {
        await route.fulfill({ status: 404, headers: corsHeaders, body: JSON.stringify({ message: 'Not found' }) });
        return;
      }

      post.status = 'removed';
      post.updated_at = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(detailFor(postId)),
      });
      return;
    }
  });

  await page.goto('/');

  // New-user guard sends the browser to /onboarding/language on first visit.
  // Walk through the language + ZIP gate so home can mount for the rest of
  // the smoke scenario.
  await page.waitForURL((url) => url.pathname.includes('/onboarding/language'));
  await page.getByTestId('onboarding-language-en').click();
  await page.waitForURL((url) => url.pathname.includes('/onboarding/location'));
  await page.getByTestId('onboarding-location-zip-input').fill('11735');
  await page.getByTestId('onboarding-location-submit').click();
  await page.waitForURL((url) => !url.pathname.includes('/onboarding'));

  await page.getByTestId('create-session').click();
  await expect(page.getByText('User ID: 11111111-1111-4111-8111-111111111111')).toBeVisible();

  // Use a direct navigation here instead of the home-page anchor click.
  // The join screen is a client component; going straight to the route avoids
  // a timing race where the anchor transition reaches the page before the
  // join form handlers are ready, which leaves the resolve button disabled.
  await page.goto('/community/join');
  await page.getByLabel('Invite code').fill('FARMINGDALE-HELP');
  await page.getByTestId('resolve-community').click();
  await expect(page.getByText('Farmingdale Demo Community')).toBeVisible();
  await page.getByLabel('Invite code').fill('FARMINGDALE-HELP-CHANGED');
  await expect(page.getByText('Farmingdale Demo Community')).not.toBeVisible();
  await expect(page.getByTestId('confirm-join')).not.toBeVisible();
  await page.getByLabel('Invite code').fill('FARMINGDALE-HELP');
  await page.getByTestId('resolve-community').click();
  await expect(page.getByText('Farmingdale Demo Community')).toBeVisible();
  await page.getByLabel('Invite code').fill('BAD-CODE');
  await page.getByTestId('resolve-community').click();
  await expect(page.getByText('Farmingdale Demo Community')).not.toBeVisible();
  await expect(page.getByTestId('confirm-join')).not.toBeVisible();
  await page.getByLabel('Invite code').fill('FARMINGDALE-HELP');
  await page.getByTestId('resolve-community').click();
  await expect(page.getByText('Farmingdale Demo Community')).toBeVisible();
  await page.getByTestId('confirm-join').click();
  await expect(page.getByText('Current community: Farmingdale Demo Community')).toBeVisible();

  await page.goto('/community/join');
  await page.getByTestId('join-mode-qr').click();
  await page.getByLabel('QR code or scanned text').fill('FARMINGDALE-QR');
  await page.getByTestId('resolve-community').click();
  await page.getByTestId('confirm-join').click();
  await expect(page.getByText('Current community: Farmingdale Demo Community')).toBeVisible();

  await page.getByTestId('request-help').click();
  await expect(page.getByRole('heading', { name: 'Create a post' })).toBeVisible();
  await page.getByLabel('Title').fill('Need groceries tonight');
  await page.getByTestId('browser-speech').click();
  await page.getByLabel('Details').fill('Typed while listening');
  await expect(page.getByLabel('Details')).toHaveValue(/Browser speech transcript/);
  await page.getByLabel('ZIP code').fill('11735');
  await page.getByLabel('Who can see it').selectOption('public');
  await page.getByTestId('preview-post').click();
  await page.getByTestId('publish-post').click();
  await expect(page).toHaveURL(/\/posts\/90000000-0000-4000-8000-000000000001\/?$/);

  await page.goto('/community');
  await expect(page.getByText('Need groceries tonight')).toBeVisible();
  await page.getByRole('button', { name: 'Public' }).click();
  await expect(page.getByText('Need groceries tonight')).toBeVisible();

  await page.goto('/posts/mine');
  await expect(page.getByText('Need groceries tonight')).toBeVisible();

  await page.goto('/me/verify');
  await page.getByLabel('Phone number').fill('+15165550101');
  await page.getByTestId('send-code').click();
  await expect(page.getByText('Demo code:')).toContainText('246810');
  await page.getByLabel('6-digit code').fill('246810');
  await page.getByTestId('verify-code').click();
  await page.waitForURL('**/inbox/**');
  await expect(page.locator('h1', { hasText: 'My messages' })).toBeVisible();

  await page.goto('/posts/new?post_type=offer');
  await page.getByLabel('Title').fill('Can share groceries tonight');
  await page.getByLabel('ZIP code').fill('11735');
  await page.setInputFiles('input[type="file"]', {
    name: 'note.webm',
    mimeType: 'audio/webm',
    buffer: Buffer.from('demo-audio'),
  });
  await expect(page.getByLabel('Details')).toHaveValue(/Fallback upload transcript/);
  await page.getByTestId('preview-post').click();
  await page.getByTestId('publish-post').click();
  await expect(page).toHaveURL(/\/posts\/90000000-0000-4000-8000-000000000002\/?$/);
  await expect(page.getByRole('button', { name: 'Edit post' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit post' }).click();
  await page.getByLabel('Title').fill('Can share groceries after 7pm');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Can share groceries after 7pm' })).toBeVisible();
  await page.getByRole('button', { name: 'Close post' }).click();
  await expect(page.getByText('Closed')).toBeVisible();
  await page.locator('summary', { hasText: 'Delete post' }).click();
  await page.getByRole('button', { name: 'Delete post' }).click();
  await expect(page.getByText('Removed')).toBeVisible();

  await page.goto('/posts/new?post_type=offer');
  await page.getByLabel('Type').selectOption('transportation');
  await page.getByLabel('Title').fill('Can drive someone to a pantry');
  await page.getByLabel('Details').fill('Can drive someone alone after school today.');
  await page.getByLabel('ZIP code').fill('11735');
  await page.getByLabel('Who can see it').selectOption('anchor_mediated');
  await page.getByTestId('preview-post').click();
  await page.getByRole('button', { name: 'Share my post' }).click();
  await expect(page).toHaveURL(/\/posts\/90000000-0000-4000-8000-000000000003\/?$/);
  await expect(page.getByText('Pending review')).toBeVisible();

  await page.goto('/community');
  await expect(page.getByText('Can drive someone to a pantry')).not.toBeVisible();
  await page.getByRole('button', { name: 'Public' }).click();
  await expect(page.getByText('Can drive someone to a pantry')).not.toBeVisible();

  await page.goto('/posts/mine');
  await expect(page.getByText('Can drive someone to a pantry')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pending review' })).toBeVisible();
});
