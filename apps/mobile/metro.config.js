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

module.exports = config;
