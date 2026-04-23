// Minimal stub for `react-native-reanimated` under the Node jest env.
// Skeleton (and any future atom that imports from this package) only
// needs the public API to be callable — nothing actually animates in
// a test that doesn't render. Wave B's jest-expo preset ships the
// official `react-native-reanimated/mock` bundle and this stub can go
// away then.

const React = require('react');

const Animated = {
  View: function ViewStub(props) {
    return React.createElement('div', props, props && props.children);
  },
  Text: function TextStub(props) {
    return React.createElement('span', props, props && props.children);
  },
  createAnimatedComponent: (Comp) => Comp,
};

const sharedValueShape = (initial) => ({ value: initial });

module.exports = {
  __esModule: true,
  default: Animated,
  useSharedValue: (initial) => sharedValueShape(initial),
  useAnimatedStyle: (fn) => (typeof fn === 'function' ? fn() : {}),
  withTiming: (v) => v,
  withSequence: (...args) => args[args.length - 1],
  withRepeat: (v) => v,
  cancelAnimation: () => {},
  Easing: { linear: (t) => t, inOut: () => (t) => t, ease: (t) => t },
};
