// expo-font test stub. The real package ships `export * from './Font'`
// (ES module syntax) which jest-ts-jest can't parse without a custom
// transformIgnorePatterns. We don't actually load fonts in tests — the
// atoms consume `theme.fontFamilies.*` as plain strings via Restyle, so
// a noop `loadAsync` is sufficient.
module.exports = {
  __esModule: true,
  loadAsync: () => Promise.resolve(),
  isLoaded: () => true,
  isLoading: () => false,
  useFonts: () => [true, null],
};
