// Minimal `react-native` mock for the M1 smoke test.
//
// The real `react-native` package ships a Flow-typed `index.js` that jest
// cannot parse without the full RN jest preset. This stub lets the theme
// tokens (which flow through @shopify/restyle → react-native) resolve
// cleanly in Node. Wave B replaces this with the proper jest-expo setup.
module.exports = {
  Platform: { OS: 'ios', select: (obj) => obj.ios ?? obj.default },
  StyleSheet: { create: (styles) => styles, flatten: (x) => x },
  PixelRatio: { getFontScale: () => 1, getPixelSizeForLayoutSize: (v) => v, get: () => 1 },
  useColorScheme: () => 'light',
  Dimensions: { get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }) },
  I18nManager: { isRTL: false, getConstants: () => ({ isRTL: false }) },
};
