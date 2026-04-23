// `react-native` test stub — M1 scaffold + R4 atoms extension.
//
// The real `react-native` package ships a Flow-typed `index.js` that jest
// cannot parse without the full jest-expo preset. M1 shipped a tiny stub
// covering `Platform` / `StyleSheet` / `Dimensions` etc. so theme tokens
// could resolve; R4 introduces the first round of component tests (Icon,
// IconButton) via `@testing-library/react-native`, which walks the
// render tree produced by `react-test-renderer` and queries by host-
// component tag (`View`, `Text`, `Pressable`, etc). We therefore expose
// those primitives as thin React components that emit *host-type*
// elements (tag name as a plain string) — exactly how RN's real renderer
// marks its leaves.
//
// The stub is intentionally side-effect-free; we only forward props, do
// not implement layout, and do not run native animations. That's
// acceptable for atom-level component tests which assert a11y props,
// children, and press handlers — not visual geometry.
//
// When the full jest-expo preset lands, this stub is deleted and the
// moduleNameMapper entry in jest.config.js is removed.

const React = require('react');

// Factory for host-level stubs. Returning `React.createElement(tag,
// props, children)` where `tag` is a string makes RNTL treat the
// returned element as a host component — the same contract the real RN
// renderer honours.
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
// Modal is included for RNTL's detectHostComponentNames probe — the
// library renders a sentinel tree with View/Text/TextInput/Image/
// Switch/ScrollView/Modal to discover the renderer's host-component
// naming. Atoms don't render a Modal directly today, but if the stub
// omits it, RNTL throws before a single atom test gets to render.
const Modal = hostStub('Modal');

// Pressable — RN's touch handler. For atom tests we need onPress to
// fire, so we forward it via host props. RNTL's fireEvent.press walks
// the node tree looking for the nearest onPress handler, so a plain
// stub is enough.
const Pressable = React.forwardRef(function Pressable(props, ref) {
  return React.createElement('Pressable', { ...props, ref }, props.children);
});
Pressable.displayName = 'Pressable';

const ActivityIndicator = React.forwardRef(function ActivityIndicator(props, ref) {
  return React.createElement('ActivityIndicator', { ...props, ref });
});
ActivityIndicator.displayName = 'ActivityIndicator';

module.exports = {
  // Platform APIs consumed by Restyle + atoms.
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
  // Primitives for atoms.
  View,
  Text,
  TextInput,
  Image,
  Switch,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
};
