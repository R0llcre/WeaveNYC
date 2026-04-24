/**
 * push-notifications.ts — unit tests for the P3-A APNs pipeline.
 *
 * Four cases per the phase spec:
 *   1. `requestPushPermission` returns `'granted'` when the simulator grants.
 *   2. `registerDeviceForPush` returns a non-empty Expo token.
 *   3. `registerDeviceWithBackend` POSTs the correct shape to the backend.
 *   4. Category registration doesn't throw on mount.
 *
 * `expo-notifications` and `expo-constants` are mocked via the Jest
 * `moduleNameMapper` (see `jest.config.js`) — this file tweaks the
 * default mock with `jest.spyOn` where a per-case override is needed.
 */

import * as Notifications from 'expo-notifications';

import {
  configureNotificationCategories,
  registerDeviceForPush,
  registerDeviceWithBackend,
  requestPushPermission,
} from '../push-notifications';

// fetch lives on globalThis in Node 18+ but we still stub it per-test so
// registerDeviceWithBackend hits a spy instead of the real network.
const originalFetch = global.fetch;

// expo-constants defaults to `expoConfig.extra = {}`; push-notifications
// branches on `extra.eas.projectId`. We prime the project id by
// doubling the module here so the pipeline picks it up.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: { projectId: 'test-project' },
      },
    },
  },
}));

// The persistence layer is exercised at module-boundary only here — we
// short-circuit loadPreferences / savePreferences so the MMKV / Dexie
// path isn't required to prove the pipeline's fetch / permission shape.
jest.mock('@/lib/persistence', () => ({
  __esModule: true,
  loadPreferences: jest.fn(async () => ({})),
  savePreferences: jest.fn(async () => undefined),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('requestPushPermission', () => {
  it("returns 'granted' when the simulator grants", async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
      granted: true,
      ios: { status: 'granted' },
    });

    const status = await requestPushPermission();

    expect(status).toBe('granted');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('registerDeviceForPush', () => {
  it('returns a non-empty Expo token', async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
      type: 'expo',
      data: 'ExponentPushToken[abc-123]',
    });

    const token = await registerDeviceForPush();

    expect(token).toBe('ExponentPushToken[abc-123]');
    expect(token.length).toBeGreaterThan(0);
    // EAS project id from the mocked expo-constants is passed through.
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'test-project',
    });
  });
});

describe('registerDeviceWithBackend', () => {
  it('POSTs the correct shape to /v1/devices/register', async () => {
    const fetchSpy = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      text: async () => '',
    })) as unknown as typeof fetch;
    global.fetch = fetchSpy;

    await registerDeviceWithBackend(
      'access-token-xyz',
      'ExponentPushToken[abc]',
      { deviceId: 'device-uuid-1', locale: 'en' },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchSpy as unknown as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url.endsWith('/v1/devices/register')).toBe(true);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBe('Bearer access-token-xyz');
    expect(JSON.parse(init.body as string)).toEqual({
      device_id: 'device-uuid-1',
      push_token: 'ExponentPushToken[abc]',
      platform: 'ios',
      locale: 'en',
    });
  });
});

describe('configureNotificationCategories', () => {
  it("doesn't throw on mount and registers all three categories", async () => {
    (
      Notifications.setNotificationCategoryAsync as jest.Mock
    ).mockResolvedValue(true);

    await expect(configureNotificationCategories()).resolves.toBeUndefined();

    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledTimes(3);
    const registered = (
      Notifications.setNotificationCategoryAsync as jest.Mock
    ).mock.calls.map((call) => call[0]);
    expect(registered).toEqual(
      expect.arrayContaining(['CHAT_MESSAGE', 'CONTACT_REQUEST', 'POST_MATCH']),
    );
  });
});
