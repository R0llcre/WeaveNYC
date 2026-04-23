/**
 * SandboxBanner atom — import + shape + demo-flag logic tests.
 *
 * The `isDemoSandboxBuild()` helper is the only piece of the atom that
 * we can exercise in a plain Node env (it's a pure read from
 * `expo-constants`). Its strictness matters: a truthy-but-non-boolean
 * value must NOT enable the demo banner in production builds.
 */

describe('SandboxBanner atom', () => {
  // We `require` each test to get a fresh module, then override the
  // expo-constants mock per case via `jest.doMock`. `resetModules` is
  // mandatory — ESM imports cache the module body at first evaluation.

  beforeEach(() => {
    jest.resetModules();
  });

  it('exports a callable component + helper', () => {
    const mod = require('./SandboxBanner');
    expect(typeof mod.SandboxBanner).toBe('function');
    expect(typeof mod.isDemoSandboxBuild).toBe('function');
  });

  it('is re-exported from the ui barrel', () => {
    const barrel = require('./index');
    const direct = require('./SandboxBanner');
    expect(barrel.SandboxBanner).toBe(direct.SandboxBanner);
    expect(barrel.isDemoSandboxBuild).toBe(direct.isDemoSandboxBuild);
  });

  it('helper returns false when expoConfig.extra.isDemo is absent', () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: {} } },
    }));
    const { isDemoSandboxBuild } = require('./SandboxBanner');
    expect(isDemoSandboxBuild()).toBe(false);
  });

  it('helper returns false for truthy non-boolean values (e.g. "true")', () => {
    // An env-var interpolation could land here as a string. We want
    // the production bundle to stay sandbox-free in that case.
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: { isDemo: 'true' } } },
    }));
    const { isDemoSandboxBuild } = require('./SandboxBanner');
    expect(isDemoSandboxBuild()).toBe(false);
  });

  it('helper returns true only on literal `true`', () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: { isDemo: true } } },
    }));
    const { isDemoSandboxBuild } = require('./SandboxBanner');
    expect(isDemoSandboxBuild()).toBe(true);
  });

  it('helper tolerates a missing expoConfig', () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {},
    }));
    const { isDemoSandboxBuild } = require('./SandboxBanner');
    expect(isDemoSandboxBuild()).toBe(false);
  });
});
