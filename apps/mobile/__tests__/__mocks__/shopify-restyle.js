// `@shopify/restyle` test stub — R4 atoms extension.
//
// Restyle's runtime touches a handful of RN internals that our minimal
// `react-native` stub doesn't implement. For atom tests we only need two
// escape hatches:
//
//   - `ThemeProvider` passes a theme object down through a React context.
//   - `useTheme()` reads it back inside `useAppTheme()`.
//
// Everything else (spacing / color variant compilers, etc.) is unused at
// the atom layer because atoms resolve tokens through `useAppTheme()`
// directly rather than Restyle variants.
const React = require('react');

const ThemeContext = React.createContext(null);

function ThemeProvider({ theme, children }) {
  return React.createElement(ThemeContext.Provider, { value: theme }, children);
}

function useTheme() {
  const theme = React.useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme called outside of ThemeProvider');
  }
  return theme;
}

// `createTheme` is typically called at module-evaluation time by
// `src/theme/tokens.ts` to produce the Theme object. The production call
// accepts an arbitrary token shape and returns it back (with some type
// massaging); the stub just echoes it so tests see the same tokens.
function createTheme(tokens) {
  return tokens;
}

module.exports = {
  ThemeProvider,
  useTheme,
  createTheme,
};
