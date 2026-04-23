// Minimal stub for `expo-font`. Loading fonts is a side effect the
// jest smoke tier doesn't care about; `loadAsync` resolves immediately.
module.exports = {
  __esModule: true,
  loadAsync: () => Promise.resolve(),
  isLoaded: () => true,
  isLoading: () => false,
  useFonts: () => [true, null],
};
