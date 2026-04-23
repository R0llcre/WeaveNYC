// `react-native-reanimated` test stub for M3b Toast.
//
// The real package's bundled `mock.js` transitively imports from
// `./index`, which runs native module lookups and crashes under the Node
// test runner. We ship a tiny in-tree stub that satisfies the Toast
// atom's specific API surface — `Animated.View`, `useSharedValue`,
// `useAnimatedStyle`, `withTiming`, and `Easing` — and nothing more. If
// future atoms need more reanimated APIs, add them here rather than
// switching on the official mock (which would pull in the whole native
// stack).

const React = require('react');

const View = React.forwardRef(function AView(props, ref) {
  return React.createElement('Animated.View', { ...props, ref }, props.children);
});
View.displayName = 'Animated.View';

const Text = React.forwardRef(function AText(props, ref) {
  return React.createElement('Animated.Text', { ...props, ref }, props.children);
});
Text.displayName = 'Animated.Text';

// `useSharedValue` returns a `{ value }` ref. The Toast reads `.value`
// to snapshot entry animations; we back it with a real object so
// `value = newValue` assignments actually mutate.
function useSharedValue(initial) {
  return { value: initial };
}

// `useAnimatedStyle` normally runs on the UI thread and pipes its return
// into a C++ prop adapter. For tests we call the factory eagerly and
// return the style object directly — sufficient for snapshot/style
// assertions to read animated transforms.
function useAnimatedStyle(factory) {
  return factory();
}

// `withTiming` normally returns an opaque animation descriptor that the
// reanimated worklet consumes. Tests only care about the target value
// (so assertions can read `translateY.value` after a tick and see the
// end state), so we return the target directly.
function withTiming(toValue) {
  return toValue;
}

const Easing = {
  linear: (t) => t,
  ease: (t) => t,
  quad: (t) => t,
  cubic: (t) => t,
  in: (fn) => fn ?? ((t) => t),
  out: (fn) => fn ?? ((t) => t),
  inOut: (fn) => fn ?? ((t) => t),
  bezier: () => (t) => t,
};

const Animated = {
  View,
  Text,
  createAnimatedComponent: (Comp) => Comp,
};

module.exports = {
  __esModule: true,
  default: Animated,
  View,
  Text,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
};
