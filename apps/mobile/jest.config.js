// Jest config for mobile.
//
// M1 shipped a Node-only smoke test for theme imports. R2 extends the
// config so the first atom ports (Pill, Tag, Banner) can be rendered via
// `@testing-library/react-native` — without pulling in the full
// `jest-expo` preset (which needs a Flow-aware Babel chain + native-
// module setup that Wave B intentionally defers to a later milestone).
//
// Strategy
// --------
// Stay on the Node test environment (fast, deterministic); keep the
// minimal `react-native` stub so Restyle resolves its handful of runtime
// checks; add stubs for the two third-party modules the R2 atoms touch
// (`expo-haptics`, `@shopify/restyle`) and for the theme's font loader
// (which `require()`s binaries not yet vendored in). Atom tests then
// render through RNTL and assert on a11y props, children, and press
// handlers — not pixel-level geometry.
//
// Adding a new mock: create `__tests__/__mocks__/<pkg>.js`, then append a
// `moduleNameMapper` entry below. Prefer small, spy-able no-op shapes
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
    // Haptic feedback — Pill + Banner call `selectionAsync` / `impactAsync`.
    // Stub to spy-able jest.fn so tests can assert on press intent.
    '^expo-haptics$': '<rootDir>/__tests__/__mocks__/expo-haptics.js',
    // Restyle's runtime references RN internals; a lightweight shim covers
    // `createTheme` / `ThemeProvider` / `useTheme` — enough for atoms.
    '^@shopify/restyle$': '<rootDir>/__tests__/__mocks__/shopify-restyle.js',
    // `src/theme/fonts.ts` does `require(...ttf)` for the font loader. The
    // binaries aren't vendored yet; swap the module for a stub that
    // matches the public surface so tokens can still import from
    // `@/theme` without the loader crashing. We map both the absolute
    // alias and the sibling `./fonts` import used inside `src/theme/index.ts`.
    '^@/theme/fonts$': '<rootDir>/__tests__/__mocks__/theme-fonts.js',
    '^\\./fonts$': '<rootDir>/__tests__/__mocks__/theme-fonts.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { isolatedModules: true, tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
