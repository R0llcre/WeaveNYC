// Jest config for mobile — Wave B consolidated.
//
// `jest-expo` preset is the RIGHT long-term choice for RN component tests,
// but it requires a full transform/setup chain (Flow types in RN polyfills,
// Metro bundler shim, native-module mocks) that balloons test startup
// from ~1s to ~15s. A later wave can wire it in alongside the first
// screen-level test.
//
// Strategy
// --------
// Stay on the Node test environment (fast, deterministic); keep the
// minimal `react-native` stub so Restyle resolves its handful of runtime
// checks; add stubs for the third-party modules the 20 Wave B atoms
// touch (`expo-haptics`, `@shopify/restyle`, `expo-font`, `expo-constants`,
// `react-native-reanimated`, `react-native-safe-area-context`) and for
// the theme's font loader (which `require()`s binaries not yet vendored
// in). Atom tests then render through RNTL and assert on a11y props,
// children, and press handlers — not pixel-level geometry.
//
// Adding a new mock: create `__tests__/__mocks__/<pkg>.js`, then append
// a `moduleNameMapper` entry below. Prefer small, spy-able no-op shapes
// over reimplementing the native behaviour — tests care about the
// *contract*, not the runtime work.

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
    // Reanimated: Toast / Skeleton use `useSharedValue` / `useAnimatedStyle`
    // / `withTiming` / `Easing`. Real `mock.js` transitively imports native
    // modules and crashes under Node.
    '^react-native-reanimated$': '<rootDir>/__tests__/__mocks__/react-native-reanimated.js',
    // Safe-area context used by PageHeader / route scaffolding.
    '^react-native-safe-area-context$': '<rootDir>/__tests__/__mocks__/react-native-safe-area-context.js',
    // Expo Router — screens across S2 (home wizard / directory), S4 (chat),
    // and S6 (onboarding) import `router` / `useRouter` / `useSegments` /
    // `useLocalSearchParams` / `Slot` / `Stack` / `Link`. The real package
    // pulls in a Metro transform + the file-based routing runtime that we
    // don't want at Node test time. The stub re-exports a spy-able `router`
    // and a `__setParams` test helper so tests can assert navigation and
    // plant URL params.
    '^expo-router$': '<rootDir>/__tests__/__mocks__/expo-router.js',
    // `@expo/vector-icons` ships ESM + bundled font requires. Our stub
    // exposes no-op React components with a stable `Icon` display name so
    // screen tests can assert on icon presence without parsing the real
    // module's font loader.
    '^@expo/vector-icons$': '<rootDir>/__tests__/__mocks__/expo-vector-icons.js',
    '^@expo/vector-icons/.*$': '<rootDir>/__tests__/__mocks__/expo-vector-icons.js',
    // Haptic feedback — Button, IconButton, Pill, Banner, Checkbox, Radio
    // call `selectionAsync` / `impactAsync`. Stub to spy-able jest.fn so
    // tests can assert on press intent.
    '^expo-haptics$': '<rootDir>/__tests__/__mocks__/expo-haptics.js',
    // Expo constants — SandboxBanner reads `expoConfig.extra.isDemo`.
    '^expo-constants$': '<rootDir>/__tests__/__mocks__/expo-constants.js',
    // expo-font ships ESM-flavoured exports that jest-ts-jest can't parse.
    '^expo-font$': '<rootDir>/__tests__/__mocks__/expo-font.js',
    // Persistence layer — expo-secure-store / expo-sqlite / react-native-mmkv
    // all ship ESM / JSI-bound native bridges. Persistence tests mock
    // `@/lib/db` wholesale; these mocks just keep module-evaluation safe
    // for the import smoke suite.
    '^expo-secure-store$': '<rootDir>/__tests__/__mocks__/expo-secure-store.js',
    '^expo-sqlite$': '<rootDir>/__tests__/__mocks__/expo-sqlite.js',
    '^react-native-mmkv$': '<rootDir>/__tests__/__mocks__/react-native-mmkv.js',
    // Restyle's runtime references RN internals; a lightweight shim covers
    // `createTheme` / `ThemeProvider` / `useTheme` — enough for atoms.
    '^@shopify/restyle$': '<rootDir>/__tests__/__mocks__/shopify-restyle.js',
    // `src/theme/fonts.ts` does `require(...ttf)` for the font loader. The
    // binaries aren't vendored yet; swap the module for a stub that
    // matches the public surface so tokens can still import from
    // `@/theme` without the loader crashing. Map both the absolute alias
    // and the sibling `./fonts` import used inside `src/theme/index.ts`.
    '^@/theme/fonts$': '<rootDir>/__tests__/__mocks__/theme-fonts.js',
    '^\\./fonts$': '<rootDir>/__tests__/__mocks__/theme-fonts.js',
    // Font / asset file requires — stub with a trivial object so the theme
    // module (which uses `require('../../assets/fonts/…ttf')`) can resolve
    // in a Node test environment that has no Metro asset pipeline.
    '\\.(ttf|otf|png|jpg|jpeg|gif|svg)$': '<rootDir>/__tests__/__mocks__/file-stub.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { isolatedModules: true, tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
