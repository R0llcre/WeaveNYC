// Jest config for mobile — M1 scaffold + M3b atom coverage.
//
// `jest-expo` preset is the RIGHT long-term choice for RN component tests,
// but it requires a full transform/setup chain (Flow types in RN polyfills,
// Metro bundler shim, native-module mocks) that ballons test startup from
// ~1s to ~15s. Wave C wires it in alongside the first screen-level test.
//
// For M3b we need to render the 5 atoms (Toast, EmptyState, Field, Stack,
// Inline) through a tiny RN stub that exposes only the primitives they
// consume. The stub lives in `__tests__/__mocks__` and is installed via
// `moduleNameMapper` so every import of `react-native` resolves to it.
//
// Reanimated: Toast imports `useSharedValue` / `useAnimatedStyle` /
// `withTiming` / `Easing`. The real package's `mock.js` transitively
// imports native modules and crashes under Node, so we ship a surgical
// in-tree stub that only exposes what Toast uses.
//
// `setupFilesAfterEach`: cleanup timers after every test (Toast schedules
// `setTimeout` for auto-dismiss — without cleanup the runner hangs).

module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/ios/',
    '/android/',
    '/.expo/',
    '/__mocks__/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Route `react-native` through our local stub — the real package ships
    // Flow-typed JS that jest can't parse without the full RN preset.
    '^react-native$': '<rootDir>/__tests__/__mocks__/react-native.js',
    // Route `react-native-reanimated` through a minimal stub for Toast.
    '^react-native-reanimated$': '<rootDir>/__tests__/__mocks__/react-native-reanimated.js',
    // expo-font ships ESM-flavoured exports that jest-ts-jest can't parse.
    '^expo-font$': '<rootDir>/__tests__/__mocks__/expo-font.js',
    // Font / asset file requires — stub with a trivial object so the theme
    // module (which uses `require('../../assets/fonts/…ttf')`) can resolve
    // in a Node test environment that has no Metro asset pipeline.
    '\\.(ttf|otf|png|jpg|jpeg|svg)$': '<rootDir>/__tests__/__mocks__/asset.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { isolatedModules: true, tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
