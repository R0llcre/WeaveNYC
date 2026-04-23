// Minimal stub for `expo-constants`. Only `expoConfig.extra` is read
// by the SandboxBanner atom today. Tests that need to flip the demo
// flag override the mock via `jest.doMock` / `jest.resetModules`.
module.exports = {
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
};
