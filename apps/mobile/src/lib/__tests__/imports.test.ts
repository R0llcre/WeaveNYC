/**
 * M2 imports test — asserts every ported lib file module-loads without
 * throwing. This is the minimum bar for "the ported lib is RN-safe":
 * any file that crashes at module-evaluation time (import-side-effect
 * that touches `window.localStorage`, a top-level `new Dexie()`, a
 * Node-only `import` from a web-only package) would stop Metro from
 * bundling the app.
 *
 * Intentionally NOT testing behaviour — the hooks depend on
 * `react-native-mmkv`, expo-sqlite, and a WebSocket polyfill, none of
 * which exist under the jest `node` preset. Wave B's jest-expo preset
 * will upgrade this into a proper behavioural suite.
 *
 * The test uses `require()` because ts-jest + the `node` preset
 * resolve both relative and `@/*` path aliases at require time (see
 * `jest.config.js::moduleNameMapper`). A top-level `import` would be
 * identical semantically, but `require` makes each file's load into
 * its own sub-assertion so a single broken module doesn't stop the
 * rest of the suite.
 *
 * If you add a new file to `@/lib/*`, add a matching `expect` line
 * below. If one of these requires throws, the file has an
 * import-time side effect that's RN-unsafe — surface it behind a
 * lazy-initialised singleton or a `typeof global === 'undefined'`
 * guard before merging.
 */

describe('M2 lib ports module-load cleanly', () => {
  test('types.ts is import-safe', () => {
    const mod = require('../types');
    // Pure-type file — at runtime it only exports `narrowResourceType`.
    expect(typeof mod.narrowResourceType).toBe('function');
  });

  test('datetime.ts is import-safe', () => {
    const mod = require('../datetime');
    expect(typeof mod.toDateTimeLocalValue).toBe('function');
    expect(typeof mod.fromDateTimeLocalValue).toBe('function');
  });

  test('seed-activity.ts is import-safe', () => {
    const mod = require('../seed-activity');
    expect(Array.isArray(mod.SEED_ACTIVITY)).toBe(true);
    expect(mod.SEED_ACTIVITY.length).toBeGreaterThan(0);
    expect(Array.isArray(mod.SEED_PUBLIC_POSTS)).toBe(true);
  });

  test('match-intent.ts is import-safe', () => {
    const mod = require('../match-intent');
    expect(typeof mod.loadMatchContactIntent).toBe('function');
    expect(typeof mod.saveMatchContactIntent).toBe('function');
    expect(typeof mod.clearMatchContactIntent).toBe('function');
  });

  test('p2p-env.ts is import-safe', () => {
    const mod = require('../p2p-env');
    expect(typeof mod.isP2PDevDemoVisible).toBe('function');
  });

  test('safe-return-to.ts is import-safe', () => {
    const mod = require('../safe-return-to');
    expect(typeof mod.safeReturnTo).toBe('function');
    expect(mod.safeReturnTo('/inbox', '/')).toBe('/inbox');
    expect(mod.safeReturnTo('https://attacker.com', '/')).toBe('/');
  });

  test('demo.ts is import-safe', () => {
    const mod = require('../demo');
    expect(typeof mod.isDemoSandbox).toBe('function');
    expect(mod.DEMO_OTP_CODE).toBe('246810');
  });

  test('qr.ts is import-safe', () => {
    const mod = require('../qr');
    expect(typeof mod.parseScannedQrPayload).toBe('function');
    const parsed = mod.parseScannedQrPayload('https://weavenyc.org/c?invite_code=ABC');
    expect(parsed?.inviteCode).toBe('ABC');
  });

  test('selectors.ts is import-safe', () => {
    const mod = require('../selectors');
    expect(typeof mod.selectSession).toBe('function');
    expect(typeof mod.selectIsVerified).toBe('function');
    expect(typeof mod.selectPreferences).toBe('function');
  });

  test('store.ts is import-safe', () => {
    const mod = require('../store');
    expect(mod.store).toBeDefined();
    const state = mod.store.getState();
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('community');
    expect(state).toHaveProperty('postDraft');
    expect(state).toHaveProperty('preferences');
  });

  test('slices/auth-slice is import-safe', () => {
    const mod = require('../slices/auth-slice');
    expect(typeof mod.authReducer).toBe('function');
    expect(typeof mod.setSession).toBe('function');
    expect(typeof mod.clearSession).toBe('function');
    expect(typeof mod.hydrateSession).toBe('function');
  });

  test('slices/community-slice is import-safe', () => {
    const mod = require('../slices/community-slice');
    expect(typeof mod.communityReducer).toBe('function');
    expect(typeof mod.hydrateCommunity).toBe('function');
    expect(typeof mod.upsertJoinedCommunity).toBe('function');
  });

  test('slices/post-draft-slice is import-safe', () => {
    const mod = require('../slices/post-draft-slice');
    expect(typeof mod.postDraftReducer).toBe('function');
    expect(typeof mod.hydratePostDraft).toBe('function');
    expect(typeof mod.mergePostDraft).toBe('function');
    expect(typeof mod.resetPostDraft).toBe('function');
  });

  test('slices/preferences-slice is import-safe', () => {
    const mod = require('../slices/preferences-slice');
    expect(typeof mod.preferencesReducer).toBe('function');
    expect(typeof mod.hydratePreferences).toBe('function');
    expect(typeof mod.setLanguage).toBe('function');
    expect(typeof mod.setZipCode).toBe('function');
  });

  test('api.ts is import-safe', () => {
    const mod = require('../api');
    expect(typeof mod.getApiBaseUrl).toBe('function');
    expect(typeof mod.createAnonymousSession).toBe('function');
    expect(typeof mod.refreshSession).toBe('function');
    expect(typeof mod.logoutSession).toBe('function');
    expect(typeof mod.getChatWebSocketUrl).toBe('function');
  });

  test('db.ts is import-safe', () => {
    const mod = require('../db');
    expect(typeof mod.getPwaDb).toBe('function');
    // M6 (Wave B consolidation) replaced the M2 stub (null facade) with
    // the expo-sqlite + MMKV + SecureStore backed Dexie-shaped facade.
    // `getPwaDb()` now always returns a non-null handle. See
    // `apps/mobile/src/lib/__tests__/persistence.test.ts` for the
    // behavioural suite.
    const db = mod.getPwaDb();
    expect(db).not.toBeNull();
    expect(typeof db.kv.get).toBe('function');
  });

  test('persistence.ts stub is import-safe', () => {
    const mod = require('../persistence');
    expect(typeof mod.loadPreferences).toBe('function');
    expect(typeof mod.saveSession).toBe('function');
    expect(typeof mod.listPendingPosts).toBe('function');
    expect(typeof mod.filterVisiblePostsForScope).toBe('function');
    // Stub reads return null; pure helpers are fully functional.
    return mod.listPendingPosts().then((pending: unknown[]) => {
      expect(pending).toEqual([]);
    });
  });

  test('p2p-worker-client.ts stub is import-safe', () => {
    const mod = require('../p2p-worker-client');
    expect(typeof mod.createBrowserP2PWorkerClient).toBe('function');
    // Stub always returns null — useCommunityP2PSync handles that path.
    expect(
      mod.createBrowserP2PWorkerClient({
        onStatus: () => {},
        onSync: () => {},
        onError: () => {},
      }),
    ).toBeNull();
  });

  test('hooks.ts is import-safe', () => {
    const mod = require('../hooks');
    expect(typeof mod.useAppDispatch).toBe('function');
    expect(typeof mod.useAppSelector).toBe('function');
    expect(typeof mod.useResources).toBe('function');
    expect(typeof mod.useOtpStart).toBe('function');
    expect(typeof mod.useOutboxDrain).toBe('function');
    expect(typeof mod.useCommunityP2PSync).toBe('function');
  });

  test('use-chat-websocket.ts is import-safe', () => {
    const mod = require('../use-chat-websocket');
    expect(typeof mod.useChatWebSocket).toBe('function');
  });

  test('use-session-bootstrap.ts is import-safe', () => {
    const mod = require('../use-session-bootstrap');
    expect(typeof mod.useSessionBootstrap).toBe('function');
  });

  test('use-sign-out.ts is import-safe', () => {
    const mod = require('../use-sign-out');
    expect(typeof mod.useSignOut).toBe('function');
  });
});
