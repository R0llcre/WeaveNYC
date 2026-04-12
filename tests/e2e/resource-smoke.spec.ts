import { expect, test } from '@playwright/test';

test('language -> zip -> list -> detail -> bookmark smoke flow', async ({ page }) => {
  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
  };
  const resourceListResponse = {
    items: [
      {
        provider_id: '77777777-7777-4777-8777-777777777777',
        name: "St. Kilian's Social Ministry",
        type: 'pantry',
        address: '140 Elizabeth St., Farmingdale, NY 11735',
        city: 'Farmingdale',
        state: 'NY',
        zip: '11735',
        phone: '5167569656',
        languages: ['en', 'es'],
        source: 'island_harvest',
        source_label: 'Island Harvest Pantry Finder',
        notes: 'Official pantry listing.',
        distance_miles: 0.15,
        is_open_today: true,
        is_open_now: false,
        geo_precision: 'street',
        directions_url: 'https://maps.apple.com/?q=140%20Elizabeth%20St.%2C%20Farmingdale%2C%20NY%2011735',
      },
      {
        provider_id: '88888888-8888-4888-8888-888888888888',
        name: 'Hope for the Future',
        type: 'pantry',
        address: '131 Verdi Street, Farmingdale, NY 11735',
        city: 'Farmingdale',
        state: 'NY',
        zip: '11735',
        phone: '(631)752-5771',
        languages: ['en'],
        source: 'island_harvest',
        source_label: 'Island Harvest Pantry Finder',
        notes: 'Official pantry listing.',
        distance_miles: 1.99,
        is_open_today: true,
        is_open_now: false,
        geo_precision: 'street',
        directions_url: 'https://maps.apple.com/?q=131%20Verdi%20Street%2C%20Farmingdale%2C%20NY%2011735',
      },
      {
        provider_id: '99999999-9999-4999-8999-999999999999',
        name: 'St. Martin of Tours - Bethpage',
        type: 'pantry',
        address: '208 Broadway, Bethpage, NY 11714',
        city: 'Bethpage',
        state: 'NY',
        zip: '11714',
        phone: '(516)931-7332',
        languages: ['en'],
        source: 'island_harvest',
        source_label: 'Island Harvest Pantry Finder',
        notes: 'Nearby pantry.',
        distance_miles: 1.81,
        is_open_today: true,
        is_open_now: false,
        geo_precision: 'street',
        directions_url: 'https://maps.apple.com/?q=208%20Broadway%2C%20Bethpage%2C%20NY%2011714',
      },
    ],
    next_cursor: null,
    source_mode: 'fixture',
  };

  const detailResponse = {
    ...resourceListResponse.items[0],
    weekly_hours: [
      { day: 'mon', windows: [{ opens_at: '09:00AM', closes_at: '12:00PM' }], closed: false },
      { day: 'tue', windows: [{ opens_at: '09:00AM', closes_at: '12:00PM' }], closed: false },
      { day: 'wed', windows: [{ opens_at: '09:00AM', closes_at: '12:00PM' }], closed: false },
      { day: 'thu', windows: [{ opens_at: '09:00AM', closes_at: '12:00PM' }], closed: false },
      { day: 'fri', windows: [], closed: true },
      { day: 'sat', windows: [], closed: true },
      { day: 'sun', windows: [], closed: true },
    ],
    source_url: 'https://storerocket.io/api/user/n0pjnLgp6V/locations',
    requested_provider_id: null,
  };
  const otpStartResponse = {
    challenge_id: '22222222-2222-4222-8222-222222222222',
    masked_destination: '(***) ***-0101',
    delivery_channel: 'sms',
    expires_in_seconds: 600,
    fallback: true,
    demo_code: '246810',
  };
  const otpVerifyResponse = {
    access_token: 'jwt-verified',
    refresh_token: 'rt_verified',
    user: {
      user_id: '11111111-1111-4111-8111-111111111111',
      level: 'verified',
    },
    issued_via: 'otp',
  };

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
        access_token: 'jwt',
        refresh_token: 'rt_fixture',
        user: {
          user_id: '11111111-1111-4111-8111-111111111111',
          level: 'anonymous',
        },
        issued_via: 'anonymous',
      }),
    });
  });

  await page.route('**/v1/resources**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const url = route.request().url();
    if (url.includes('/v1/resources/77777777-7777-4777-8777-777777777777')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(detailResponse),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(resourceListResponse),
    });
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
      body: JSON.stringify(otpStartResponse),
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
      body: JSON.stringify(otpVerifyResponse),
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

  await page.goto('/');

  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await expect(page.getByTestId('create-session')).toBeVisible();
  await page.getByTestId('create-session').click();
  await expect(page.getByText('user_id: 11111111-1111-4111-8111-111111111111')).toBeVisible();

  await page.getByPlaceholder('11735').fill('11735');
  await page.getByTestId('see-nearby').click();
  await expect(page.locator('article').first()).toContainText('St. Kilian');

  await page.locator('[data-testid^="bookmark-"]').first().click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Guardado' }).first()).toBeVisible();

  await page.locator('[data-testid^="resource-detail-"]').first().click();
  await page.waitForURL('**/resources/77777777-7777-4777-8777-777777777777');
  await expect(page.getByText('Horario semanal')).toBeVisible();
  await expect(page.getByText('Notas')).toBeVisible();

  await page.goto('/verify');
  await expect(page.getByTestId('verify-title')).toBeVisible();
  await page.getByTestId('send-code').click();
  await expect(page.getByText('246810')).toBeVisible();
  await page.getByLabel('Código de verificación').fill('246810');
  await page.getByTestId('verify-code').click();
  await page.waitForURL('**/inbox');
  await expect(page.locator('h1', { hasText: 'Inbox' })).toBeVisible();

  await page.goto('/');
  await expect(page.getByText('Sesión verificada')).toBeVisible();

  await page.goto('/dev/m0');
  await expect(page.getByText('Check the API, mint an anonymous session, and stop there.')).toBeVisible();
});
