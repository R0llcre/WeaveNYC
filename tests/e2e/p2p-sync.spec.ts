import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';

/**
 * P8 finding 3 (P0) — Two-context sync propagation.
 *
 * Member A publishes a post in context A; member B, in a separate browser
 * context, should see the new post appear in their community feed within
 * ~10 seconds (audit P8.3). This validates that the HTTP catch-up polling
 * path (/v1/communities/:id/bootstrap -> /sync) propagates server-side
 * state changes to a second pair of eyeballs without either side depending
 * on a real WebSocket.
 *
 * WHY `test.skip` IS APPLIED:
 *   The PWA's P2P sync worker is a DedicatedWorker instantiated via
 *   `new Worker(new URL('../workers/p2p-sync.worker.ts', import.meta.url))`.
 *   Under Playwright + Next.js, the bundler-produced worker URL passes
 *   through route-level `page.route` mocks for HTTP requests it makes from
 *   inside the worker — but:
 *
 *     1. The worker only starts after the user clicks the "Save posts on my
 *        device" button in /community. That button has no stable testid (as
 *        of merge of PR #40) so targeting it is i18n-brittle.
 *     2. The worker's polling interval is 30s. `page.clock.install()` can
 *        fast-forward that, but it also freezes fetch timeouts (AbortSignal
 *        .timeout uses the same clock), which trips the worker's own
 *        timeout path and masks real sync behaviour.
 *     3. Forcing the worker to emit `syncNow()` requires either a
 *        visibilitychange event or an `online` event — both of which are
 *        dispatched on `document` / `window` but Playwright's
 *        `page.emulateMedia({ reducedMotion: 'reduce' })` style APIs don't
 *        cover them natively. Manual dispatch via `page.evaluate` works for
 *        visibility but the worker binds to the `online` event on the
 *        worker scope, not the document.
 *
 *   Rather than ship a flaky test or a fake-green placeholder, this file
 *   documents the intended flow AND the structural fixtures required to
 *   un-skip it. The actual contract coverage lives in:
 *     - services/api-gateway/test/p2p-sync.test.ts (SERVER propagation —
 *       fanout, isolation, cursor discipline — already green in main).
 *     - apps/pwa/src/workers/p2p-sync.worker.test.ts (CLIENT worker
 *       lifecycle, bootstrap + catchup pagination, WS reconnect backoff).
 *     - packages/shared/test/p2p-wire-compat.test.ts (WIRE contract — the
 *       frozen m6-v1 envelopes this spec would send on the network).
 *
 * TO UN-SKIP:
 *   1. Add `data-testid="p2p-enable"` + `data-testid="p2p-sync-now"` to the
 *      two buttons in apps/pwa/src/components/community-screen.tsx
 *      (lines ~455-476 at the time of writing).
 *   2. Add a test-only Playwright helper that drives syncNow via the
 *      worker's postMessage interface (the `BrowserP2PWorkerClient.sync()`
 *      bridge is already there; wire a window-scoped escape hatch in
 *      hooks.ts `useCommunityP2PSync` when `process.env.NEXT_PUBLIC_E2E === '1'`).
 *   3. Replace the TODO sections below with real `await page.clock`
 *      invocations once the worker-vs-fetch-timeout interaction is
 *      understood (or switch to a `route.continue({ delay })` pattern that
 *      side-steps `page.clock` entirely).
 */

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
  contact_pref: null;
};

type SyncEnvelope = {
  sync_event_id: string;
  community_id: string;
  topic: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  occurred_at: string;
  actor_p2p_id: string | null;
  cid: string | null;
  signature: null;
  payload: unknown;
};

type SessionPayload = {
  access_token: string;
  refresh_token: string;
  user: { user_id: string; level: 'verified' };
  issued_via: 'otp';
};

type SharedState = {
  posts: PostRecord[];
  syncEvents: SyncEnvelope[];
  sequence: number;
};

const communityId = '44444444-4444-4444-8444-444444444444';
const userAId = '11111111-1111-4111-8111-111111111111';
const userBId = '22222222-2222-4222-8222-222222222222';

const communitySummary = {
  community_id: communityId,
  name: 'Farmingdale Demo Community',
  center_zip: '11735',
  join_policy: 'invite_only' as const,
};

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function createSession(userId: string, token: string): SessionPayload {
  return {
    access_token: token,
    refresh_token: `${token}-refresh`,
    user: { user_id: userId, level: 'verified' },
    issued_via: 'otp',
  };
}

function createSharedState(): SharedState {
  return { posts: [], syncEvents: [], sequence: 1 };
}

/**
 * Seed Dexie so the target page bypasses /onboarding and arrives on
 * /community already authenticated + joined. Mirrors the
 * `seedSession()` pattern in tests/e2e/matching-inbox.spec.ts — same DB
 * shape, same key names.
 */
async function seedSessionAndCommunity(
  context: BrowserContext,
  session: SessionPayload,
) {
  await context.addInitScript(
    async ({ seedSession, seedCommunity }) => {
      await new Promise<void>((resolve, reject) => {
        const request = window.indexedDB.open('weavenyc-pwa', 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.createObjectStore('kv', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('joinedCommunities')) {
            db.createObjectStore('joinedCommunities', { keyPath: 'communityId' });
          }
          if (!db.objectStoreNames.contains('drafts')) {
            db.createObjectStore('drafts', { keyPath: 'key' });
          }
        };
        request.onerror = () =>
          reject(request.error ?? new Error('Failed to seed indexedDB'));
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['kv', 'joinedCommunities'], 'readwrite');
          tx.objectStore('kv').put({ key: 'auth-session', value: seedSession });
          tx.objectStore('kv').put({
            key: 'preferences',
            value: {
              language: 'en',
              zipCode: '11735',
              onboardingComplete: true,
              lowBandwidth: false,
              bookmarks: [],
            },
          });
          tx.objectStore('kv').put({
            key: 'community-current',
            value: seedCommunity.community_id,
          });
          tx.objectStore('joinedCommunities').put({
            communityId: seedCommunity.community_id,
            value: {
              community: seedCommunity,
              joinedAt: new Date().toISOString(),
            },
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () =>
            reject(tx.error ?? new Error('Failed to write seed state'));
        };
      });
    },
    { seedSession: session, seedCommunity: communitySummary },
  );
}

/**
 * Install the shared-state route handlers. Both contexts hit the same
 * `state` object — POST /v1/posts from A appends a post AND an event;
 * GET /v1/communities/:id/sync from B reads the event log.
 */
async function installSharedRoutes(page: Page, state: SharedState) {
  async function fulfill(route: Route, body: unknown, status = 200) {
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(body),
    });
  }

  await page.route('**/healthz', (route) =>
    fulfill(route, { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() }),
  );
  await page.route('**/readyz', (route) =>
    fulfill(route, { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() }),
  );

  // WS handshake is explicitly rejected so the worker falls through to the
  // HTTP polling path (which is what this test exercises).
  await page.route('**/v1/ws/p2p**', (route) =>
    route.fulfill({ status: 503, body: '' }),
  );

  await page.route('**/v1/auth/anonymous', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await fulfill(route, createSession(userAId, 'jwt-a'));
  });

  await page.route('**/v1/contact-requests/inbox**', (route) =>
    fulfill(route, { items: [], next_cursor: null }),
  );

  await page.route(`**/v1/communities/${communityId}/bootstrap`, (route) =>
    fulfill(route, {
      community_id: communityId,
      bootstrap_version: 'm6-anchor-sync-v1',
      anchor_node: {
        node_id: 'anchor-node-1',
        websocket_url: `wss://test.local/v1/ws/p2p?token=ws-token-${Date.now()}`,
        last_published_at: null,
      },
      relay_nodes: [],
      topics: {
        posts: `weavenyc/${communityId}/posts`,
        announcements: `weavenyc/${communityId}/announcements`,
        reports: `weavenyc/${communityId}/reports`,
      },
      latest_snapshot: {
        last_event_at: state.syncEvents.at(-1)?.occurred_at ?? null,
        event_count: state.syncEvents.length,
      },
      mdns_demo_enabled: false,
    }),
  );

  await page.route(`**/v1/communities/${communityId}/sync**`, async (route) => {
    const url = new URL(route.request().url());
    const since = url.searchParams.get('since');
    const sinceIdx = since ? Number.parseInt(since.replace(/^v1\./, ''), 10) : 0;
    const startIdx = Number.isFinite(sinceIdx) ? Math.max(0, sinceIdx) : 0;
    const events = state.syncEvents.slice(startIdx);
    const nextIdx = startIdx + events.length;
    await fulfill(route, {
      events,
      next_since: events.length > 0 ? `v1.${nextIdx}` : since,
      server_time: new Date().toISOString(),
      latest_snapshot: {
        last_event_at: state.syncEvents.at(-1)?.occurred_at ?? null,
        event_count: state.syncEvents.length,
      },
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
        await fulfill(route, { items: state.posts.filter((p) => p.is_owner), next_cursor: null });
        return;
      }
      const scope = url.searchParams.get('scope') ?? 'community';
      const items = state.posts.filter((post) => {
        if (post.status !== 'active') return false;
        if (post.privacy === 'anchor_mediated') return false;
        if (scope === 'public') return post.privacy === 'public';
        return post.community_id === communityId;
      });
      await fulfill(route, { items, next_cursor: null });
      return;
    }

    if (route.request().method() === 'POST' && url.pathname === '/v1/posts') {
      const body = route.request().postDataJSON();
      const now = new Date().toISOString();
      const postId = `90000000-0000-4000-8000-${String(state.sequence++).padStart(12, '0')}`;
      const post: PostRecord = {
        post_id: postId,
        community_id: body.community_id,
        post_type: body.post_type,
        category: body.category,
        title: body.title,
        body: body.body,
        language: body.language,
        location_zip: body.location_zip,
        privacy: body.privacy,
        status: 'active',
        risk_level: 'low',
        created_at: now,
        updated_at: now,
        expires_at: body.expires_at,
        is_owner: true,
        contact_pref: null,
      };
      state.posts.push(post);
      state.syncEvents.push({
        sync_event_id: `00000000-0000-4000-8000-${String(state.sequence).padStart(12, '0')}`,
        community_id: body.community_id,
        topic: `weavenyc/${body.community_id}/posts`,
        event_type: 'post.published',
        aggregate_type: 'post',
        aggregate_id: postId,
        occurred_at: now,
        actor_p2p_id: 'actor_aaaaaaaaaaaaaaaaaaaaaaaa',
        cid: 'deadbeef'.repeat(8),
        signature: null,
        payload: {
          post: {
            post_id: postId,
            community_id: body.community_id,
            title: body.title,
            body: body.body,
            post_type: body.post_type,
            category: body.category,
            language: body.language,
            location_zip: body.location_zip,
            privacy: body.privacy,
            status: 'active',
            risk_level: 'low',
            created_at: now,
            updated_at: now,
            expires_at: body.expires_at,
            is_owner: false,
            p2p_version: 1,
            ipfs_cid: null,
          },
        },
      });
      await fulfill(route, { post_id: postId, status: 'active', risk_level: 'low' });
      return;
    }

    await route.fulfill({ status: 404, headers: corsHeaders, body: '{}' });
  });
}

test.skip('two-context sync: member A publishes, member B sees within 10s', async ({
  browser,
}) => {
  // The skip above is intentional — see the top-of-file comment for the
  // three structural blockers (missing testids on the P2P enable/sync
  // buttons, page.clock interaction with fetch timeouts, and the
  // visibilitychange-vs-worker-scope gap). The code below is the concrete
  // shape of the test that we want to restore once those blockers land.

  const state = createSharedState();

  // Context A — publisher.
  const contextA = await browser.newContext();
  await seedSessionAndCommunity(contextA, createSession(userAId, 'jwt-a'));
  const pageA = await contextA.newPage();
  await installSharedRoutes(pageA, state);

  // Context B — consumer. Must NOT see A's posts until the P2P sync layer
  // catches B up.
  const contextB = await browser.newContext();
  await seedSessionAndCommunity(contextB, createSession(userBId, 'jwt-b'));
  const pageB = await contextB.newPage();
  await installSharedRoutes(pageB, state);

  // 1) A navigates home and lands on /community with the community hero
  //    already mounted (session + joinedCommunity pre-seeded).
  await pageA.goto('/community');
  await expect(pageA.getByTestId('request-help')).toBeVisible();

  // 2) B's feed is empty (no posts published yet).
  await pageB.goto('/community');
  await expect(pageB.getByTestId('request-help')).toBeVisible();
  await expect(pageB.getByText('Need groceries tonight')).not.toBeVisible();

  // 3) A publishes a community-only "Need groceries tonight" post. The
  //    mock appends to shared state AND appends a post.published event.
  await pageA.getByTestId('request-help').click();
  await pageA.getByLabel('Title').fill('Need groceries tonight');
  await pageA.getByLabel('Details').fill('Need help with groceries tonight.');
  await pageA.getByLabel('ZIP code').fill('11735');
  await pageA.getByTestId('preview-post').click();
  await pageA.getByTestId('publish-post').click();
  await expect(pageA).toHaveURL(/\/posts\/\d+\/?$/);

  // 4) Shared state now carries 1 post + 1 sync event. B's worker catches
  //    up via /v1/communities/.../sync → post.published, which invalidates
  //    the posts query; the subsequent /v1/posts fetch returns the post.
  //
  //    TODO (un-skip): drive this step via `await pageB.getByTestId('p2p-sync-now').click()`
  //    once the testid is added. For now, validate the mechanism at the
  //    HTTP layer by nudging the react-query cache: navigate away + back.
  await pageB.goto('/', { waitUntil: 'domcontentloaded' });
  await pageB.goto('/community');

  // 5) Within 10s, B should see A's post in the community feed.
  await expect(pageB.getByText('Need groceries tonight')).toBeVisible({ timeout: 10_000 });

  await contextA.close();
  await contextB.close();
});
