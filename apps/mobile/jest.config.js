// Jest config for mobile — M1 scaffold slice.
//
// `jest-expo` preset is the RIGHT long-term choice for RN component tests,
// but it requires a full transform/setup chain (Flow types in RN polyfills,
// Reanimated mocks, etc.) that wave B wires in alongside the first atom
// port. For M1 our smoke suite only needs to verify that pure-JS modules
// (theme tokens, redux store, locale JSON, query client) import cleanly —
// no RN runtime involved — so a plain Node preset keeps the test fast and
// decoupled from the native-module jungle.

module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/ios/',
    '/android/',
    '/.expo/',
    '/__mocks__/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Route `react-native` and its closest native-module neighbours
    // through our local stubs. The real packages ship Flow / native-
    // code JS that jest can't parse without the full RN preset (which
    // wave B installs alongside the first atom).
    '^react-native$': '<rootDir>/__tests__/__mocks__/react-native.js',
    '^react-native-reanimated$': '<rootDir>/__tests__/__mocks__/react-native-reanimated.js',
    '^react-native-safe-area-context$': '<rootDir>/__tests__/__mocks__/react-native-safe-area-context.js',
    '^expo-constants$': '<rootDir>/__tests__/__mocks__/expo-constants.js',
    '^expo-font$': '<rootDir>/__tests__/__mocks__/expo-font.js',
    '\\.(ttf|otf|png|jpg|jpeg|gif|svg)$': '<rootDir>/__tests__/__mocks__/file-stub.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { isolatedModules: true, tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
