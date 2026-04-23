// `@shopify/restyle` test stub — Wave B consolidated.
//
// Restyle's runtime touches a handful of RN internals that our minimal
// `react-native` stub doesn't implement. For atom tests we only need a
// few escape hatches:
//
//   - `createTheme(obj)` — returns its input unchanged. `tokens.ts` passes
//     the Theme object through; the typing happens externally via
//     `satisfies`.
//   - `ThemeProvider` — a pass-through React component so the theme
//     cascade still works in tests (`AppThemeProvider` wraps children
//     with it).
//   - `useTheme<T>()` — returns the *light* theme from `tokens.ts` when a
//     test renders an atom outside `AppThemeProvider`. When the provider
//     is present it reads the context value. Tests that need dark-mode
//     assertions override this mock via `jest.doMock`.
//   - `createBox` / `createText` — re-export helpers Restyle offers for
//     screens. Atoms in Wave B don't use them directly, but stubs are
//     exported so a future atom that does doesn't crash the suite.
const React = require('react');

const ThemeContext = React.createContext(null);

const createTheme = (t) => t;

const ThemeProvider = ({ theme, children }) =>
  React.createElement(
    ThemeContext.Provider,
    { value: theme },
    children,
  );

// Lazy-require the light theme so circular imports (theme <-> atom) don't
// blow up at module-eval time. Tests that want dark re-mock this module.
let _cachedLightTheme;

function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (ctx) return ctx;
  if (!_cachedLightTheme) {
    _cachedLightTheme = require('../../src/theme/tokens').theme;
  }
  return _cachedLightTheme;
}

function createBox() {
  const Box = React.forwardRef(function Box(props, ref) {
    return React.createElement('View', { ...props, ref }, props.children);
  });
  Box.displayName = 'Box';
  return Box;
}

function createText() {
  const Text = React.forwardRef(function Text(props, ref) {
    return React.createElement('Text', { ...props, ref }, props.children);
  });
  Text.displayName = 'Text';
  return Text;
}

module.exports = {
  __esModule: true,
  createTheme,
  ThemeProvider,
  useTheme,
  createBox,
  createText,
};
