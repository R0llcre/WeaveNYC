import { expect, test } from '@playwright/test';

/**
 * V2-D — crisis-first Home wizard E2E.
 *
 * Asserts the full `/` wizard flow:
 *   1. A first-visit user completing onboarding lands on the wizard (not
 *      the directory) because `preferences.lastIntent` is null by default.
 *   2. Tapping "I'm hungry right now" (intent `food_now`) swaps the wizard
 *      for the directory in-place — no router.push — and the directory
 *      mounts with `openNow=true` on the resource search query and the
 *      Open now chip in its active state.
 *   3. The "Change what I'm looking for" ghost button reappears at the
 *      top of the directory so the user can return to the wizard.
 */

test('home wizard — pick an intent, land on pre-filtered directory', async ({ page }) => {
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
        is_open_now: true,
        geo_precision: 'street',
        directions_url:
          'https://maps.apple.com/?q=140%20Elizabeth%20St.%2C%20Farmingdale%2C%20NY%2011735',
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
        is_open_now: true,
        geo_precision: 'street',
        directions_url:
          'https://maps.apple.com/?q=131%20Verdi%20Street%2C%20Farmingdale%2C%20NY%2011735',
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
        is_open_now: true,
        geo_precision: 'street',
        directions_url:
          'https://maps.apple.com/?q=208%20Broadway%2C%20Bethpage%2C%20NY%2011714',
      },
    ],
    next_cursor: null,
    source_mode: 'fixture',
  };

  // Capture the search query strings so we can assert `open_now=1` was
  // forwarded to the backend when the user taps the "food_now" intent.
  const resourceSearchUrls: string[] = [];

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

  await page.route('**/v1/auth/refresh', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        access_token: 'jwt-refreshed',
        refresh_token: 'rt_fixture_rotated',
        user: {
          user_id: '11111111-1111-4111-8111-111111111111',
          level: 'anonymous',
        },
        issued_via: 'refresh',
      }),
    });
  });

  await page.route('**/v1/resources**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const url = route.request().url();
    if (url.includes('/v1/resources/search')) {
      resourceSearchUrls.push(url);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(resourceListResponse),
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

  // Drive the onboarding funnel so `preferences.onboardingComplete` flips
  // and the user has a ZIP saved before they land on `/`. Same path the
  // `resource-smoke.spec.ts` uses; without it the `<HomeWizard />` still
  // renders, but the directory query would be disabled by the
  // `hasValidZip` guard and our assertions would observe the empty state
  // instead of an actual search call.
  await page.goto('/onboarding/language/?explicit=1');
  await page.waitForURL((url) => url.pathname.startsWith('/onboarding/language'));
  await page.getByTestId('onboarding-language-en').click();
  await page.waitForURL((url) => url.pathname.startsWith('/onboarding/trust'));
  await page.getByTestId('onboarding-trust-continue').click();
  await page.waitForURL((url) => url.pathname.startsWith('/onboarding/location'));
  await page.getByTestId('onboarding-location-zip-input').fill('11735');
  await page.getByTestId('onboarding-location-submit').click();
  await page.waitForURL((url) => !url.pathname.includes('/onboarding'));

  // First assertion: the wizard is the first screen after onboarding.
  // `home-wizard` is the wrapper testid on the wizard main element.
  await expect(page.getByTestId('home-wizard')).toBeVisible();
  // All four intent cards are present.
  await expect(page.getByTestId('need-food-now')).toBeVisible();
  await expect(page.getByTestId('need-food-week')).toBeVisible();
  await expect(page.getByTestId('need-doctor')).toBeVisible();
  await expect(page.getByTestId('need-sleep')).toBeVisible();

  // Tap "I'm hungry right now". The dispatch swaps the wizard for the
  // pre-filtered directory in place.
  await page.getByTestId('need-food-now').click();

  // Second assertion: the directory is mounted. The wizard wrapper is
  // gone and the "All" filter pill (testid `see-nearby`) is present.
  await expect(page.getByTestId('home-wizard')).toHaveCount(0);
  await expect(page.getByTestId('see-nearby')).toBeVisible();

  // Third assertion: the Open now chip is active (aria-pressed="true").
  // This is the visible signal the user gets that the list was filtered
  // from their intent.
  await expect(page.getByTestId('home-filter-open-now')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Fourth assertion: the resource search API was called with the
  // `open_now` query param. We scan the captured URLs for the most
  // recent one and check its query string.
  expect(resourceSearchUrls.length).toBeGreaterThan(0);
  const latestSearch = new URL(resourceSearchUrls.at(-1) as string);
  expect(latestSearch.searchParams.get('open_now')).toBe('1');

  // Fifth assertion: the "Change what I'm looking for" ghost button is
  // now visible on the directory hero so the user can return to the
  // wizard if they picked the wrong intent.
  await expect(page.getByTestId('home-change-intent')).toBeVisible();

  // Sixth assertion: tapping the ghost button clears the intent and the
  // wizard reappears.
  await page.getByTestId('home-change-intent').click();
  await expect(page.getByTestId('home-wizard')).toBeVisible();
  await expect(page.getByTestId('see-nearby')).toHaveCount(0);
});
