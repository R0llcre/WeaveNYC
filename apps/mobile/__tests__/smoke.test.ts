/**
 * Smoke test — asserts the core modules of the M1 scaffold can be
 * imported without throwing. This is the minimum bar for "the app
 * boots": if any of these imports crashes at module-evaluation time,
 * Metro's bundler would produce a broken artefact on every `expo
 * start`.
 *
 * We deliberately AVOID rendering the root layout here — that would
 * pull in `react-native-gesture-handler`, SafeAreaProvider, and the
 * Expo Router runtime, all of which need the full jest-expo preset.
 * Wave B switches this test over to a React Native Testing Library
 * render once the native-module jest setup is wired.
 */

describe('M1 scaffold smoke', () => {
  test('theme tokens import cleanly', () => {
    // Import tokens directly — ../src/theme/index re-exports from
    // react-native (useColorScheme) which needs the full RN jest preset.
    // Wave B swaps this once jest-expo is fully wired.
    const mod = require('../src/theme/tokens');
    expect(mod.theme).toBeDefined();
    expect(mod.darkTheme).toBeDefined();
    expect(mod.theme.colors.accent).toBe('#c73d3d');
    expect(mod.darkTheme.colors.accent).toBe('#e85a5a');
  });

  test('theme spacing + radii present', () => {
    const { theme } = require('../src/theme/tokens');
    expect(theme.spacing.l).toBe(16);
    expect(theme.spacing.xxl).toBe(24);
    expect(theme.borderRadii.pill).toBe(9999);
  });

  test('theme text variants shape matches spec', () => {
    const { theme } = require('../src/theme/tokens');
    expect(theme.textVariants.display).toBeDefined();
    expect(theme.textVariants.h1).toBeDefined();
    expect(theme.textVariants.body).toBeDefined();
    expect(theme.textVariants.micro).toBeDefined();
  });

  test('en/es/zh-Hans chrome locales all ship the same keys', () => {
    const en = require('../src/locales/en/chrome.json');
    const es = require('../src/locales/es/chrome.json');
    const zh = require('../src/locales/zh-Hans/chrome.json');
    const enKeys = Object.keys(en).sort();
    expect(Object.keys(es).sort()).toEqual(enKeys);
    expect(Object.keys(zh).sort()).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThanOrEqual(10);
  });

  test('Redux store exposes the expected shape', () => {
    const { store } = require('../src/store');
    const state = store.getState();
    expect(state).toHaveProperty('placeholder');
  });

  test('TanStack Query client exists', () => {
    const { queryClient } = require('../src/providers/query-client');
    expect(queryClient).toBeDefined();
    expect(typeof queryClient.getQueryCache).toBe('function');
  });
});
