/**
 * V2-C — Playwright coverage for the Home activity ticker.
 *
 * Asserts that an anonymous visitor landing on `/` sees:
 *   - the neighbor banner above the ticker
 *   - at least one visible ticker row (the rotation starts at index 0
 *     and advances every 4s; we wait for the first row)
 *
 * Onboarding is bypassed by pre-seeding preferences in IndexedDB so the
 * shell doesn't bounce us to `/onboarding/language`. API traffic is
 * fully stubbed so the resources query never hits the network.
 *
 * Complements:
 *   - apps/pwa/src/components/activity-ticker.test.tsx (vitest)
 *   - apps/pwa/src/components/resource-home.test.tsx  (vitest)
 */
import { expect, test } from '@playwright/test';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

test('anonymous visitor sees the neighbor banner + ticker on Home', async ({ page }) => {
  // Skip onboarding by pre-populating preferences in Dexie's kv store
  // (mirrors the pattern used in `tests/e2e/settings.spec.ts`). No
  // session row is seeded — we want to exercise the anonymous path.
  await page.addInitScript(() => {
    const request = indexedDB.open('weavenyc-pwa', 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.close();
        return;
      }
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({
        key: 'preferences',
        value: {
          language: 'en',
          zipCode: '11735',
          onboardingComplete: true,
          lowBandwidth: false,
          bookmarks: [],
          defaultPostVisibility: 'community_only',
          locationPrecision: 'zip_only',
          hasUserChosenLanguage: true,
          trustBannerDismissed: true,
        },
      });
      tx.oncomplete = () => db.close();
    };
  });

  // Stub the anonymous-session mint + resource list so the home page
  // renders without network errors. The ticker content is entirely
  // client-side (sourced from `seed-activity.ts`) so it doesn't depend
  // on any API response.
  await page.route('**/healthz', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ status: 'ok' }),
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ items: [], next_cursor: null, source_mode: 'fixture' }),
    });
  });

  await page.goto('/');

  // Neighbor banner is static, renders on first paint.
  await expect(page.getByTestId('home-neighbor-banner')).toBeVisible();

  // Ticker mounts after hydration. Its region has a stable testid and
  // wraps at least one visible row — we assert on the currently-visible
  // row (index 0 = `marisol-rice`) to confirm the social layer is live.
  await expect(page.getByTestId('activity-ticker')).toBeVisible();
  await expect(
    page.getByTestId('activity-ticker-row-marisol-rice').first(),
  ).toBeVisible();
});
