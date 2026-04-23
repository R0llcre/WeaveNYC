// Metro bundler config — monorepo-aware.
// WeaveNYC is a pnpm workspace; Metro needs to know that `node_modules` can be
// resolved from two places (the app's own folder AND the repo root, where pnpm
// hoists the workspace's shared devDeps). It also needs permission to watch
// files OUTSIDE of `apps/mobile/` so that hot-reload fires when we edit
// `packages/shared/`.
//
// `unstable_enablePackageExports` is required by the modern Expo SDK for any
// dep that ships conditional exports (e.g. `@tanstack/react-query`). Without
// it, Metro falls back to the legacy `main` field and loads the wrong CJS
// bundle — React Query throws "No QueryClient set" at runtime.
//
// SVG transformer (M4a-1):
//   We swap Metro's default babel transformer for
//   `react-native-svg-transformer/expo`. That transformer turns `.svg` files
//   into React components backed by `react-native-svg`, letting atoms write:
//       import Food from '@/assets/icons/food.svg';
//       <Food width={24} height={24} />
//   The resolver tweak removes `svg` from the *asset* extension list (so
//   Metro stops treating it as an image file) and adds it to `sourceExts`
//   (so the transformer picks it up as source code instead).

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enablePackageExports = true;

// --- SVG transformer wiring -----------------------------------------------
// Standard Expo recipe for `react-native-svg-transformer`. See:
//   https://github.com/kristerkari/react-native-svg-transformer#expo
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((e) => e !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
};

module.exports = config;
