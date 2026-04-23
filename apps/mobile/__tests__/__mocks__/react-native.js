// Minimal `react-native` mock for the mobile jest suite.
//
// The real `react-native` package ships a Flow-typed `index.js` that jest
// cannot parse without the full RN jest preset. This stub lets code that
// flows through `react-native` (theme tokens via @shopify/restyle,
// atoms in ./src/components/ui) resolve cleanly in a plain Node env.
// Wave B swaps this out for the proper jest-expo setup.
//
// The contract here is intentionally "just enough":
//   - Flat primitive shims for Platform, StyleSheet, PixelRatio,
//     Dimensions, I18nManager so ./src/theme/* imports resolve.
//   - No-op element factories for View / Text / Pressable so atom
//     modules evaluate without trying to access real native views.
//   - Minimal AccessibilityInfo + Linking so Skeleton / ResourceCard
//     can `import` them at module scope.
//
// None of these shims actually *render* anything — the existing smoke
// test only exercises module imports, not UI trees. Once jest-expo is
// wired (wave B), this mock can be deleted.

const React = require('react');

function makeElement(tag) {
  return function ElementStub(props) {
    return React.createElement(tag, props, props && props.children);
  };
}

const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios ?? obj.default,
};

const StyleSheet = {
  create: (styles) => styles,
  flatten: (x) => x,
  hairlineWidth: 1,
};

const PixelRatio = {
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (v) => v,
  get: () => 1,
};

const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
};

const I18nManager = {
  isRTL: false,
  getConstants: () => ({ isRTL: false }),
};

const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(false),
  addEventListener: () => ({ remove: () => {} }),
  announceForAccessibility: () => {},
};

const Linking = {
  openURL: () => Promise.resolve(),
  canOpenURL: () => Promise.resolve(true),
  addEventListener: () => ({ remove: () => {} }),
  getInitialURL: () => Promise.resolve(null),
};

const InteractionManager = {
  runAfterInteractions: (cb) => {
    if (typeof cb === 'function') cb();
    return { cancel: () => {} };
  },
};

module.exports = {
  Platform,
  StyleSheet,
  PixelRatio,
  useColorScheme: () => 'light',
  Dimensions,
  I18nManager,
  AccessibilityInfo,
  Linking,
  InteractionManager,
  View: makeElement('div'),
  Text: makeElement('span'),
  Pressable: makeElement('button'),
  ScrollView: makeElement('div'),
  FlatList: makeElement('div'),
  SectionList: makeElement('div'),
  SafeAreaView: makeElement('div'),
  ActivityIndicator: makeElement('div'),
  Switch: makeElement('input'),
  TextInput: makeElement('input'),
  Image: makeElement('img'),
};
