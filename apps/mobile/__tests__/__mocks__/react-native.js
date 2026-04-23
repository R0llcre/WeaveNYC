// `react-native` test stub — R2 + R3 atom component tests.
//
// The real `react-native` package ships a Flow-typed `index.js` that jest
// cannot parse without the full RN jest preset (jest-expo), which the
// mobile lane defers until the Metro/SVG transformer work in a later wave.
//
// Atom tests use `@testing-library/react-native` which walks the render
// tree produced by `react-test-renderer` and queries by host-component
// tag (`View`, `Text`, `Pressable`, etc). We therefore expose those
// primitives as thin React components that emit *host-type* elements
// (tag name as a plain string) — exactly how RN's real renderer marks its
// leaves. That contract is enough for atom-level tests that assert a11y
// props, children, and press handlers.
//
// The stub is intentionally side-effect-free; we only forward props, do
// not implement layout, and do not run native animations.

const React = require('react');

// Factory for host-level stubs. Returning a plain-string tag name makes
// RNTL treat the returned element as a host component — the same contract
// the real RN renderer honours.
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
const Image = hostStub('Image');
const Switch = hostStub('Switch');
const ScrollView = hostStub('ScrollView');
const Modal = hostStub('Modal');

// Pressable — RN's touch handler. For atom tests we need onPress to fire,
// so we forward props verbatim; RNTL's fireEvent.press walks the tree
// looking for the nearest onPress handler, and a plain host stub is
// enough to expose it.
const Pressable = React.forwardRef(function Pressable(props, ref) {
  return React.createElement('Pressable', { ...props, ref }, props.children);
});
Pressable.displayName = 'Pressable';

const TouchableOpacity = React.forwardRef(function TouchableOpacity(props, ref) {
  return React.createElement('TouchableOpacity', { ...props, ref }, props.children);
});
TouchableOpacity.displayName = 'TouchableOpacity';

const ActivityIndicator = React.forwardRef(function ActivityIndicator(props, ref) {
  return React.createElement('ActivityIndicator', { ...props, ref });
});
ActivityIndicator.displayName = 'ActivityIndicator';

const FlatList = hostStub('FlatList');

const Linking = {
  openURL: jest.fn(() => Promise.resolve(true)),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
};

const Vibration = {
  vibrate: jest.fn(),
  cancel: jest.fn(),
};

const AccessibilityInfo = {
  isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  announceForAccessibility: jest.fn(),
};

function makeAnimatedValue(initial) {
  return {
    setValue: jest.fn(),
    interpolate: () => ({ interpolate: () => ({}) }),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    stopAnimation: jest.fn(),
    __getValue: () => initial ?? 0,
  };
}
const noopAnim = () => ({
  start: jest.fn((cb) => cb && cb({ finished: true })),
  stop: jest.fn(),
  reset: jest.fn(),
});
const Animated = {
  Value: function Value(initial) {
    return makeAnimatedValue(initial);
  },
  View,
  Text,
  Image,
  ScrollView,
  timing: () => noopAnim(),
  spring: () => noopAnim(),
  sequence: () => noopAnim(),
  loop: () => noopAnim(),
  delay: () => noopAnim(),
  parallel: () => noopAnim(),
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
    roundToNearestPixel: (v) => Math.round(v),
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
  Image,
  Switch,
  ScrollView,
  Modal,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
  Vibration,
  AccessibilityInfo,
  Animated,
};
