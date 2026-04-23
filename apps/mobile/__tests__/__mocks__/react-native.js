// `react-native` test stub — M1 scaffold + M3b atom coverage.
//
// The real `react-native` package ships a Flow-typed `index.js` that jest
// cannot parse without the full RN jest preset (jest-expo). That preset
// pulls in Metro / Flow / Babel polyfills that balloon test startup from
// ~1s to ~15s, which is the wrong tradeoff for atom-level component
// tests that don't need native modules. Wave C wires jest-expo properly;
// until then M3b exposes the primitives its 5 atoms need (`View`, `Text`,
// `TextInput`, `Pressable`, `AccessibilityInfo`) as thin host stubs.
//
// RNTL (`@testing-library/react-native`, if later introduced) walks the
// tree produced by `react-test-renderer` and queries by host-component
// tag. Emitting `React.createElement('View', …)` produces a host-type
// element — the same contract the real RN renderer honours — so assertions
// like `.toBeTruthy()` and `props.onPress` still resolve.

const React = require('react');

/** Host-level component stub — creates a `React.createElement(tag, …)`
 *  with a string tag so it's treated as a host component by test renderers. */
function hostStub(tag) {
  const Stub = React.forwardRef(function Stub(props, ref) {
    return React.createElement(tag, { ...props, ref }, props.children);
  });
  Stub.displayName = tag;
  return Stub;
}

const View = hostStub('View');
const Text = hostStub('Text');
const TextInput = hostStub('TextInput');

// Pressable resolves the function-style `style={({ pressed }) => …}` and
// `children={({ pressed }) => …}` forms eagerly to a plain object so
// snapshots render a stable style blob.
const Pressable = React.forwardRef(function Pressable(props, ref) {
  const { style, children, ...rest } = props;
  const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
  const resolvedChildren =
    typeof children === 'function' ? children({ pressed: false }) : children;
  return React.createElement(
    'Pressable',
    { ...rest, style: resolvedStyle, ref },
    resolvedChildren,
  );
});
Pressable.displayName = 'Pressable';

// Toast calls `AccessibilityInfo.isReduceMotionEnabled()`. Return `false`
// by default (= animation runs); individual tests can jest.spyOn to flip.
const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(false),
  isScreenReaderEnabled: () => Promise.resolve(false),
  addEventListener: () => ({ remove: () => {} }),
  announceForAccessibility: () => {},
};

module.exports = {
  Platform: { OS: 'ios', select: (obj) => obj.ios ?? obj.default },
  StyleSheet: {
    create: (styles) => styles,
    flatten: (x) => {
      if (!x) return {};
      if (Array.isArray(x)) return Object.assign({}, ...x.filter(Boolean));
      return x;
    },
    hairlineWidth: 1,
    absoluteFill: {},
    absoluteFillObject: {},
  },
  PixelRatio: {
    getFontScale: () => 1,
    getPixelSizeForLayoutSize: (v) => v,
    get: () => 1,
  },
  useColorScheme: () => 'light',
  Dimensions: {
    get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
    addEventListener: () => ({ remove: () => {} }),
  },
  I18nManager: { isRTL: false, getConstants: () => ({ isRTL: false }) },
  View,
  Text,
  TextInput,
  Pressable,
  AccessibilityInfo,
};
