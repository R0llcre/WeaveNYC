// Babel config for the WeaveNYC mobile app.
//
// Plugin ordering matters: `react-native-reanimated/plugin` MUST be the last
// entry in the `plugins` array (see Reanimated's install docs). Violating
// this ordering breaks worklet detection at build time and produces cryptic
// "ReferenceError: _WORKLET is not defined" crashes at runtime.
//
// `expo-router/babel` was merged into `babel-preset-expo` in SDK 50+, so we
// no longer list it separately — `babel-preset-expo` already wires it up.

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
