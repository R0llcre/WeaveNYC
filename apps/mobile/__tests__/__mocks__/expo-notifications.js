// Minimal stub for `expo-notifications` so Node-environment tests can
// import push-notifications.ts / _layout.tsx without the native module.
// Tests that assert on the spy-able behaviour (permission → token) use
// `jest.mock('expo-notifications', …)` at the top of their test file and
// re-declare the surface with controlled mocks. This baseline shim keeps
// import smoke tests and the mount-path in `_layout.tsx` happy when the
// test file doesn't override the module.

module.exports = {
  __esModule: true,
  requestPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never',
  })),
  getPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never',
  })),
  getExpoPushTokenAsync: jest.fn(async () => ({
    type: 'expo',
    data: 'ExponentPushToken[stub-token]',
  })),
  setNotificationCategoryAsync: jest.fn(async () => true),
  setNotificationHandler: jest.fn(() => undefined),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  addNotificationReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
};
