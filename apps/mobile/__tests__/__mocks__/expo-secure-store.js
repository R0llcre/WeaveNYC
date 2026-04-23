// `expo-secure-store` test stub.
//
// The real package ships `import ExpoSecureStore from './ExpoSecureStore'`
// (ES module syntax) and delegates to a native iOS Keychain / Android
// KeyStore bridge. Jest can't parse the ESM without the full jest-expo
// preset, and there's no native runtime under Node regardless. The
// persistence module uses these helpers for the `refresh_token` and P2P
// private-key stores; under tests they round-trip through an in-memory
// Map so persistence.test.ts's flow-level assertions work without the
// Keychain.

const memory = new Map();

function getItemAsync(key) {
  return Promise.resolve(memory.has(key) ? memory.get(key) : null);
}

function setItemAsync(key, value) {
  memory.set(key, value);
  return Promise.resolve();
}

function deleteItemAsync(key) {
  memory.delete(key);
  return Promise.resolve();
}

async function isAvailableAsync() {
  return true;
}

module.exports = {
  __esModule: true,
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  isAvailableAsync,
  WHEN_UNLOCKED: 'whenUnlocked',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
  AFTER_FIRST_UNLOCK: 'afterFirstUnlock',
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
};
