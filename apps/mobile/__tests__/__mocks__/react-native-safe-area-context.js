// Minimal stub for `react-native-safe-area-context`. The real package
// depends on a native module bridge which jest can't resolve in a
// plain Node env. Only the hooks surface is used by our atoms today.
const React = require('react');

module.exports = {
  SafeAreaProvider: function SafeAreaProvider(props) {
    return React.createElement('div', props, props && props.children);
  },
  SafeAreaView: function SafeAreaView(props) {
    return React.createElement('div', props, props && props.children);
  },
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
};
