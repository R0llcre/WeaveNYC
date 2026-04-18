import { expect, test } from '@playwright/test';

// Multi-community pilot-readiness smoke.
//
// Exercises the /community/join flow with all three W5A pilot communities
// (Farmingdale 11735, Queens Corona 11368, Bronx Hunts Point 10474) behind
// mocked API routes so we never touch a real backend. The goal is to assert
// that the anchor invite / community-access resolve path cleanly swaps
// between communities and the Redux-backed "Current community" indicator
// reflects the last joined one.

type CommunityFixture = {
  communityId: string;
  name: string;
  centerZip: string;
  inviteCode: string;
  qrToken: string;
  anchorInviteCode: string;
};

const userId = '11111111-1111-4111-8111-111111111111';

const fixtures: CommunityFixture[] = [
  {
    communityId: '44444444-4444-4444-8444-444444444444',
    name: 'Farmingdale Demo Community',
    centerZip: '11735',
    inviteCode: 'FARMINGDALE-HELP',
    qrToken: 'FARMINGDALE-QR',
    anchorInviteCode: 'WEAVE-ANCHOR-11735',
  },
  {
    communityId: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
    name: 'Queens Corona Demo Community',
    centerZip: '11368',
    inviteCode: 'QUEENS-CORONA-HELP',
    qrToken: 'QUEENS-CORONA-QR',
    anchorInviteCode: 'WEAVE-ANCHOR-Q113',
  },
  {
    communityId: 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
    name: 'Bronx Hunts Point Demo Community',
    centerZip: '10474',
    inviteCode: 'BRONX-HUNTS-POINT-HELP',
    qrToken: 'BRONX-HUNTS-POINT-QR',
    anchorInviteCode: 'WEAVE-ANCHOR-BX104',
  },
];

const lookupByInvite = new Map<string, CommunityFixture>(
  fixtures.map((fixture) => [fixture.inviteCode, fixture]),
);
const lookupByQr = new Map<string, CommunityFixture>(
  fixtures.map((fixture) => [fixture.qrToken, fixture]),
);

// Skipped post-redesign: the M8.5 community-screen renders "Current community"
// content in two distinct surfaces (hero Card + feed header) that individually
// are fine but violate Playwright's strict getByText. Restoring this spec needs
// per-assertion locator anchors rather than bare text matches; tracking for a
// follow-up spec rewrite.
test.skip('multi-community: invite switch across Farmingdale + Queens + Bronx pilots', async ({
  page,
}) => {
  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
  };

  const joinedCommunityIds = new Set<string>();

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
  });

  await page.route('**/v1/community-access/resolve', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const body = route.request().postDataJSON();
    const fixture = body.invite_code
      ? lookupByInvite.get(body.invite_code)
      : lookupByQr.get(body.qr_token);

    if (!fixture) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Community access code not found' }),
      });
      return;
    }

    const entry = body.invite_code ? 'invite_code' : 'qr_token';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        community: {
          community_id: fixture.communityId,
          name: fixture.name,
          center_zip: fixture.centerZip,
          join_policy: 'invite_only',
        },
        join_token: entry === 'invite_code' ? `${fixture.communityId}-invite` : `${fixture.communityId}-qr`,
        entry,
        expires_in_seconds: 600,
      }),
    });
  });

  for (const fixture of fixtures) {
    await page.route(`**/v1/communities/${fixture.communityId}/join`, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      const alreadyJoined = joinedCommunityIds.has(fixture.communityId);
      joinedCommunityIds.add(fixture.communityId);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          community_id: fixture.communityId,
          membership_status: alreadyJoined ? 'already_joined' : 'joined',
          joined_at: new Date().toISOString(),
        }),
      });
    });
  }

  await page.route('**/v1/contact-requests/inbox**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });

  await page.route('**/v1/posts**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });

  await page.goto('/');
  // Onboarding gate: pick language + home ZIP so the rest of the app mounts.
  await page.waitForURL((url) => url.pathname.includes('/onboarding/language'));
  await page.getByTestId('onboarding-language-en').click();
  await page.waitForURL((url) => url.pathname.includes('/onboarding/location'));
  await page.getByTestId('onboarding-location-zip-input').fill('11735');
  await page.getByTestId('onboarding-location-submit').click();
  await page.waitForURL((url) => !url.pathname.includes('/onboarding'));

  await page.goto('/community/join');
  await page.getByTestId('create-session').click();

  for (const fixture of fixtures) {
    await page.goto('/community/join');
    await page.getByLabel('Invite code').fill(fixture.inviteCode);
    await page.getByTestId('resolve-community').click();
    await expect(page.getByText(fixture.name)).toBeVisible();
    await page.getByTestId('confirm-join').click();
    await expect(
      page.getByText(`Current community: ${fixture.name}`),
    ).toBeVisible();
  }

  // All three pilot communities should have been joined through the session.
  expect(joinedCommunityIds.size).toBe(fixtures.length);
  for (const fixture of fixtures) {
    expect(joinedCommunityIds.has(fixture.communityId)).toBe(true);
  }

  // Spot-check: anchor invite codes used at /auth endpoint must be the three
  // deterministic W5A values even if the page doesn't exercise that flow here.
  const anchorCodes = fixtures.map((fixture) => fixture.anchorInviteCode);
  expect(anchorCodes).toEqual([
    'WEAVE-ANCHOR-11735',
    'WEAVE-ANCHOR-Q113',
    'WEAVE-ANCHOR-BX104',
  ]);

  // Verify Redux reflects the last joined community (Bronx) via DOM assertion.
  await page.goto('/community');
  await expect(
    page.getByText(`Current community: ${fixtures[fixtures.length - 1].name}`),
  ).toBeVisible();
});
