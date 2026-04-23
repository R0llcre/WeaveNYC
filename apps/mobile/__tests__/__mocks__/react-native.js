// `react-native` test stub — Wave B consolidated.
//
// The real `react-native` package ships a Flow-typed `index.js` that jest
// cannot parse without the full RN jest preset (jest-expo). That preset
// pulls in Metro / Flow / Babel polyfills that balloon test startup from
// ~1s to ~15s, which is the wrong tradeoff for atom-level component
// tests that don't need native modules. A later wave can wire jest-expo
// properly; until then this stub exposes every primitive Wave B's 20
// atoms need as thin host stubs.
//
// `@testing-library/react-native` walks the tree produced by
// `react-test-renderer` and queries by host-component tag (`View`,
// `Text`, `Pressable`, etc). Emitting `React.createElement(tag, …)` with
// a string tag produces a host-type element — the same contract the real
// RN renderer honours — so assertions like `.toBeTruthy()`,
// `props.onPress`, and `fireEvent.press(...)` still resolve.
//
// The stub is intentionally side-effect-free: it forwards props, does
// not implement layout, and does not run native animations.

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
const Image = hostStub('Image');
const Switch = hostStub('Switch');
const ScrollView = hostStub('ScrollView');
const SectionList = hostStub('SectionList');
const SafeAreaView = hostStub('SafeAreaView');
// Modal is included for RNTL's detectHostComponentNames probe — the
// library renders a sentinel tree with View/Text/TextInput/Image/
// Switch/ScrollView/Modal to discover the renderer's host-component
// naming. Atoms don't render a Modal directly today, but if the stub
// omits it, RNTL throws before a single atom test gets to render.
const Modal = hostStub('Modal');
const FlatList = hostStub('FlatList');

// Pressable — RN's touch handler. Resolve the function-style
// `style={({ pressed }) => …}` and `children={({ pressed }) => …}` forms
// eagerly so snapshot tests see a stable style blob. For plain object /
// node children, this is a no-op.
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

const TouchableOpacity = React.forwardRef(function TouchableOpacity(props, ref) {
  return React.createElement('TouchableOpacity', { ...props, ref }, props.children);
});
TouchableOpacity.displayName = 'TouchableOpacity';

const ActivityIndicator = React.forwardRef(function ActivityIndicator(props, ref) {
  return React.createElement('ActivityIndicator', { ...props, ref });
});
ActivityIndicator.displayName = 'ActivityIndicator';

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
  isScreenReaderEnabled: jest.fn(() => Promise.resolve(false)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  announceForAccessibility: jest.fn(),
};

const InteractionManager = {
  runAfterInteractions: (cb) => {
    if (typeof cb === 'function') cb();
    return { cancel: () => {} };
  },
};

// AppState — RN lifecycle bridge. S4 chat screens subscribe to
// `change` events so a backgrounded → foregrounded transition can
// kick the WebSocket reconnect. The stub exposes a spy-able
// `addEventListener` that returns a remove-handle matching the real
// `EmitterSubscription` shape so tests can invoke the handler and
// assert on the reconnect path without a real lifecycle bus.
const AppState = {
  currentState: 'active',
  _listeners: [],
  addEventListener: jest.fn(function addEventListener(type, handler) {
    AppState._listeners.push({ type, handler });
    return {
      remove: () => {
        AppState._listeners = AppState._listeners.filter(
          (l) => l.handler !== handler,
        );
      },
    };
  }),
  // Test helper: push a state change through every registered listener.
  __emit(nextState) {
    AppState.currentState = nextState;
    for (const l of AppState._listeners) {
      if (l.type === 'change') l.handler(nextState);
    }
  },
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
  AccessibilityInfo,
  AppState,
  Linking,
  Vibration,
  InteractionManager,
  Animated,
  View,
  Text,
  TextInput,
  Image,
  Switch,
  ScrollView,
  SectionList,
  SafeAreaView,
  Modal,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
};
