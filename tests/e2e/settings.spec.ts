/**
 * M8 W2C — browser smoke for /settings and the onboarding routes introduced
 * in W3D. Mirrors the fixture pattern in tests/e2e/m5-anchor-admin-rehearsal
 * and tests/e2e/anchor-recovery: we mock the API via `page.route` so the
 * PWA dev server can render the full screen without a real api-gateway.
 *
 * Complements:
 * - services/api-gateway/test/account.test.ts (integration)
 * - apps/pwa/src/components/settings-screen.test.tsx (vitest)
 * - apps/pwa/src/components/onboarding.test.tsx (vitest)
 * - tests/smoke/real-api.ts (real-HTTP smoke)
 */
import { expect, test } from '@playwright/test';

const pwaBaseUrl = 'http://127.0.0.1:3000';
const verifiedUserId = '550e8400-e29b-41d4-a716-446655440099';
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function fakeJwt(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
}

async function seedVerifiedSessionInDexie(
  page: import('@playwright/test').Page,
) {
  // The PWA persists the auth session + preferences in IndexedDB via Dexie
  // (see apps/pwa/src/lib/persistence.ts). We pre-populate those rows before
  // the client bootstrap runs so the SettingsScreen sees a verified session
  // and the home page doesn't bounce us to /onboarding/language on final
  // router.replace('/').
  await page.addInitScript(
    ({ userId, accessToken }) => {
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
          key: 'auth-session',
          value: {
            access_token: accessToken,
            refresh_token: 'rt-verified',
            user: { user_id: userId, level: 'verified' },
            issued_via: 'otp',
          },
        });
        tx.objectStore('kv').put({
          key: 'preferences',
          value: {
            language: 'en',
            zipCode: '11385',
            onboardingComplete: true,
            lowBandwidth: false,
            bookmarks: [],
            defaultPostVisibility: 'community_only',
            locationPrecision: 'zip_only',
          },
        });
        tx.oncomplete = () => db.close();
      };
    },
    {
      userId: verifiedUserId,
      accessToken: fakeJwt({
        sub: verifiedUserId,
        level: 'verified',
        role: 'user',
        community_ids: [],
      }),
    },
  );
}

async function seedOnboardedPreferencesInDexie(
  page: import('@playwright/test').Page,
) {
  // Same as seedVerifiedSessionInDexie but for tests that don't need a session
  // — just the onboarding-complete flag so the SettingsScreen / home don't
  // redirect to /onboarding/language on first render.
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
          zipCode: '11385',
          onboardingComplete: true,
          lowBandwidth: false,
          bookmarks: [],
          defaultPostVisibility: 'community_only',
          locationPrecision: 'zip_only',
        },
      });
      tx.oncomplete = () => db.close();
    };
  });
}

async function stubHealthRoutes(
  context: import('@playwright/test').BrowserContext,
) {
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
  await context.route('**/v1/resources*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });
}

test('onboarding/language: clicking ES pill persists language and routes to /onboarding/location', async ({
  context,
  page,
}) => {
  await stubHealthRoutes(context);

  await page.goto(`${pwaBaseUrl}/onboarding/language`);
  await expect(page.getByTestId('onboarding-language-en')).toBeVisible();
  await expect(page.getByTestId('onboarding-language-es')).toBeVisible();
  await expect(page.getByTestId('onboarding-language-zh')).toBeVisible();

  await page.getByTestId('onboarding-language-es').click();

  await expect(page).toHaveURL(/\/onboarding\/location\/?$/);
});

test('onboarding/location: invalid ZIP is rejected; valid ZIP persists and routes home', async ({
  context,
  page,
}) => {
  await stubHealthRoutes(context);
  await seedOnboardedPreferencesInDexie(page);

  await page.goto(`${pwaBaseUrl}/onboarding/location`);
  const zip = page.getByTestId('onboarding-location-zip-input');
  await zip.fill('112');
  await page.getByTestId('onboarding-location-submit').click();
  await expect(page).toHaveURL(/\/onboarding\/location\/?/);

  await zip.fill('11385');
  await page.getByTestId('onboarding-location-submit').click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/?$/);
});

test('settings: renders all five sections, flips language pill, toggles low bandwidth', async ({
  context,
  page,
}) => {
  await stubHealthRoutes(context);
  await seedOnboardedPreferencesInDexie(page);

  await page.goto(`${pwaBaseUrl}/settings`);

  // Language / Privacy / Safety / Account / Help — all five heading ids exist
  await expect(page.locator('#settings-language-heading')).toBeVisible();
  await expect(page.locator('#settings-privacy-heading')).toBeVisible();
  await expect(page.locator('#settings-safety-heading')).toBeVisible();
  await expect(page.locator('#settings-account-heading')).toBeVisible();
  await expect(page.locator('#settings-help-heading')).toBeVisible();

  // language pill flip — EN is active by default, click ES
  const en = page.getByTestId('settings-language-select-en');
  const es = page.getByTestId('settings-language-select-es');
  await expect(en).toHaveAttribute('aria-pressed', 'true');
  await es.click();
  await expect(es).toHaveAttribute('aria-pressed', 'true');

  // low-bandwidth toggle — use the checkbox-row CSS handle since the label
  // itself is localized (EN: "Low-bandwidth mode", ES: "Modo de bajo
  // consumo", ZH: 低流量模式) and the state is shared across tests.
  const lowBw = page.locator('.checkbox-row input[type="checkbox"]');
  await expect(lowBw).toHaveCount(1);
  const initiallyChecked = await lowBw.isChecked();
  await lowBw.click();
  if (initiallyChecked) {
    await expect(lowBw).not.toBeChecked();
  } else {
    await expect(lowBw).toBeChecked();
  }

  // Expand danger-zone <details> by clicking the summary
  // The summary label is localized — EN "Delete your account", ES
  // "Eliminar tu cuenta", ZH "注销账号". Use a CSS handle keyed off the
  // <details class="danger-zone"><summary> pair which is stable across locales.
  const summary = page.locator('.danger-zone > summary').first();
  await summary.click();
  await expect(page.getByTestId('settings-delete-start')).toBeVisible();
});

test('settings: delete request -> confirm -> undo shows the scheduled + restored banners', async ({
  context,
  page,
}) => {
  await stubHealthRoutes(context);
  await seedVerifiedSessionInDexie(page);

  const challengeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const recoveryToken = 'uri_abcdef12_1234567890abcdef1234567890abcdef01';

  await context.route('**/v1/account/delete/request', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        challenge_id: challengeId,
        masked_destination: '(***) ***-0099',
        delivery_channel: 'sms',
        expires_in_seconds: 600,
      }),
    });
  });

  await context.route('**/v1/account/delete/confirm', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const purgeDate = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'deletion_scheduled',
        purge_date: purgeDate,
        user_id: verifiedUserId,
        undelete_recovery_token: recoveryToken,
      }),
    });
  });

  await context.route('**/v1/account/undelete', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'restored',
        user_id: verifiedUserId,
      }),
    });
  });

  await page.goto(`${pwaBaseUrl}/settings`);

  // Wait for the session-hydrated Account section so Start deletion is enabled
  await expect(page.locator('#settings-account-heading')).toBeVisible();
  await page.locator('.danger-zone > summary').first().click();

  const start = page.getByTestId('settings-delete-start');
  await expect(start).toBeEnabled({ timeout: 10_000 });
  await start.click();

  const otp = page.getByTestId('settings-delete-otp-input');
  await expect(otp).toBeVisible();
  await otp.fill('246810');

  await page.getByTestId('settings-delete-confirm').click();

  // After delete/confirm, the scheduled banner should appear with the
  // Undo button (the recovery window is open for 10 minutes).
  const undo = page.getByTestId('settings-delete-undo');
  await expect(undo).toBeVisible();
  await undo.click();

  // After undelete the screen shows a success banner and then redirects to /.
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/?$/, {
    timeout: 5_000,
  });
});
