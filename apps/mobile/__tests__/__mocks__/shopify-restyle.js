// Stub @shopify/restyle for Node test env.
//
// Restyle's real implementation does runtime inspection of the theme via
// React Context + hooks. We mirror the pieces atoms and tokens.ts call:
//   - `createTheme(obj)` — returns its input unchanged (tokens.ts passes
//      the object through; the typing happens externally via `satisfies`).
//   - `ThemeProvider` — a pass-through React component so the theme cascade
//      still works in tests (provider.tsx wraps children with it).
//   - `useTheme<T>()` — returns the *light* theme from tokens.ts. Most atom
//      tests render against light; the tests that need dark-mode assertions
//      do so by overriding this mock via `jest.doMock`.
//
// `createBox` / `createText` are re-export helpers Restyle offers for
// screens to wire styled primitives. Atoms in R2 don't use them directly,
// but we export stubs so a future atom that does doesn't crash the suite.
const React = require('react');

const createTheme = (t) => t;

const ThemeProvider = ({ children }) =>
  React.createElement(React.Fragment, null, children);

// Lazy-require the light theme so circular imports (theme <-> atom) don't
// blow up at module-eval time. Tests that want dark re-mock this module.
let _cachedLightTheme;
function useTheme() {
  if (!_cachedLightTheme) {
    _cachedLightTheme = require('../../src/theme/tokens').theme;
  }
  return _cachedLightTheme;
}

module.exports = {
  createTheme,
  ThemeProvider,
  useTheme,
  createBox: () => {
    const Box = React.forwardRef(function Box(props, ref) {
      return React.createElement('View', { ...props, ref }, props.children);
    });
    Box.displayName = 'Box';
    return Box;
  },
  createText: () => {
    const Text = React.forwardRef(function Text(props, ref) {
      return React.createElement('Text', { ...props, ref }, props.children);
    });
    Text.displayName = 'Text';
    return Text;
  },
};
