import { expect, test } from '@playwright/test';

const adminBaseUrl = 'http://127.0.0.1:3001';
const communityId = '44444444-4444-4444-8444-444444444444';
const verifiedUserId = '22222222-2222-4222-8222-222222222222';
const anchorUserId = '33333333-3333-4333-8333-333333333333';
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  // Expose the retry-after response header so fetch().headers.get('retry-after')
  // returns the fulfilled value; without this the browser hides non-simple
  // response headers from cross-origin fetches and the anchor-admin 429 branch
  // falls through to "retry later." instead of "retry in Xm Ys".
  'access-control-expose-headers': 'retry-after',
};

function fakeJwt(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
}

type RouteFactoryArgs = {
  recoveryResponder: (body: {
    community_id: string;
    recovery_code: string;
  }) => Promise<{
    status: number;
    body: unknown;
    headers?: Record<string, string>;
  }>;
};

async function setupCommonRoutes(
  context: import('@playwright/test').BrowserContext,
  { recoveryResponder }: RouteFactoryArgs,
) {
  const now = new Date().toISOString();
  const anonymousSession = {
    access_token: fakeJwt({
      sub: verifiedUserId,
      level: 'anonymous',
      role: 'user',
      community_ids: [],
    }),
    refresh_token: 'rt-anonymous',
    user: { user_id: verifiedUserId, level: 'anonymous' },
    issued_via: 'anonymous',
  };
  const verifiedSession = {
    access_token: fakeJwt({
      sub: verifiedUserId,
      level: 'verified',
      role: 'user',
      community_ids: [communityId],
    }),
    refresh_token: 'rt-verified',
    user: { user_id: verifiedUserId, level: 'verified' },
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
    user: { user_id: anchorUserId, level: 'anchor' },
    issued_via: 'anchor_session',
  };

  await context.route('http://localhost:4000/**', async (route) => {
    if (route.request().method() !== 'OPTIONS') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 204, headers: corsHeaders });
  });

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
        masked_destination: '(***) ***-0202',
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

  await context.route('**/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(verifiedSession),
    });
  });

  await context.route('**/v1/admin/communities/*/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        community_id: communityId,
        posts_this_week_request_count: 0,
        posts_this_week_offer_count: 0,
        accepted_contacts_this_week_count: 0,
        reports_this_week_count: 0,
        pending_post_review_count: 0,
        pending_report_count: 0,
      }),
    });
  });

  await context.route('**/v1/auth/anchor/session/recovery', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const body = route.request().postDataJSON() as {
      community_id: string;
      recovery_code: string;
    };
    const responder = await recoveryResponder(body);
    await route.fulfill({
      status: responder.status,
      contentType: 'application/json',
      headers: { ...corsHeaders, ...(responder.headers ?? {}) },
      body: JSON.stringify(responder.body),
    });
  });

  return { anchorSession };
}

async function completeOtpVerify(page: import('@playwright/test').Page) {
  await page.goto(`${adminBaseUrl}/login`);
  await page.getByLabel('Phone number').fill('+15165550101');
  await page.getByRole('button', { name: 'Start OTP' }).click();
  await expect(page.getByText('OTP challenge created')).toBeVisible();
  await page.getByLabel('OTP code').fill('246810');
  await page.getByRole('button', { name: 'Verify OTP' }).click();
  await expect(page.getByText('Verified session loaded.')).toBeVisible();
}

test('anchor recovery happy path: OTP -> recovery tab -> submit -> redirect', async ({
  context,
  page,
}) => {
  const { anchorSession } = await setupCommonRoutes(context, {
    recoveryResponder: async () => ({
      status: 200,
      body: { ...anchorSessionBody(), remaining_attempts: 4 },
    }),
  });

  await completeOtpVerify(page);

  await page.getByTestId('recovery-code-tab').click();
  await expect(page.getByTestId('recovery-code-submit')).toBeVisible();

  await page
    .getByTestId('recovery-code-community-select')
    .selectOption(communityId);
  await page.getByTestId('recovery-code-input').fill('ABCD-1111');
  await page.getByTestId('recovery-code-submit').click();

  await expect(page).toHaveURL(new RegExp(`^${adminBaseUrl.replace(/\//g, '\\/')}\\/?$`));
  expect(anchorSession.user.user_id).toBe(anchorUserId);
});

test('anchor recovery 400 invalid code surfaces remaining_attempts', async ({
  context,
  page,
}) => {
  await setupCommonRoutes(context, {
    recoveryResponder: async () => ({
      status: 400,
      body: {
        message: 'Recovery code is invalid or already used',
        remaining_attempts: 2,
      },
    }),
  });

  await completeOtpVerify(page);

  await page.getByTestId('recovery-code-tab').click();
  await page
    .getByTestId('recovery-code-community-select')
    .selectOption(communityId);
  await page.getByTestId('recovery-code-input').fill('ZZZZ-ZZZZ');
  await page.getByTestId('recovery-code-submit').click();

  await expect(page.getByText(/Invalid or already-used code, 2 left/)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`^${adminBaseUrl.replace(/\//g, '\\/')}\\/login\\/?$`));
});

test('anchor recovery 429 rate limit surfaces retry timer', async ({
  context,
  page,
}) => {
  await setupCommonRoutes(context, {
    recoveryResponder: async () => ({
      status: 429,
      headers: { 'retry-after': '125' },
      body: {
        message: 'Too many anchor recovery attempts. Retry in 125s.',
        remaining_attempts: 0,
      },
    }),
  });

  await completeOtpVerify(page);

  await page.getByTestId('recovery-code-tab').click();
  await page
    .getByTestId('recovery-code-community-select')
    .selectOption(communityId);
  await page.getByTestId('recovery-code-input').fill('ABCD-1111');
  await page.getByTestId('recovery-code-submit').click();

  await expect(page.getByText(/Too many attempts, retry in 2m 5s/)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`^${adminBaseUrl.replace(/\//g, '\\/')}\\/login\\/?$`));
});

function anchorSessionBody() {
  const now = new Date().toISOString();
  return {
    access_token: fakeJwt({
      sub: anchorUserId,
      level: 'anchor',
      role: 'anchor',
      community_ids: [communityId],
      anchor_community_id: communityId,
      mfa_verified_at: now,
    }),
    refresh_token: 'rt-anchor',
    user: { user_id: anchorUserId, level: 'anchor' },
    issued_via: 'anchor_session',
  };
}
