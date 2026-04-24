// Minimal stub for `expo-router`. The real package wires a deep-linking
// navigator that requires the full Expo runtime. Tests that render
// screens which import `useRouter` / `Link` / `Slot` only need a
// spy-able navigation surface — they don't exercise the real router.
const React = require('react');

const routerSpy = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
  canGoBack: jest.fn(() => false),
  setParams: jest.fn(),
};

function useRouter() {
  return routerSpy;
}

let currentParams = {};
function useLocalSearchParams() {
  return currentParams;
}

function useSegments() {
  return [];
}

function usePathname() {
  return '/';
}

function Slot(props) {
  return React.createElement(
    'View',
    null,
    props && props.children ? props.children : null,
  );
}

function Link(props) {
  return React.createElement(
    'Link',
    { href: props.href, testID: props.testID },
    props.children,
  );
}

const Tabs = function Tabs(props) {
  return React.createElement('View', null, props && props.children);
};
Tabs.Screen = function TabsScreen() {
  return null;
};

const Stack = function Stack(props) {
  return React.createElement('View', null, props && props.children);
};
Stack.Screen = function StackScreen() {
  return null;
};

// Focus-effect shim — real expo-router fires the callback on screen
// focus/blur. Under Node test env we fire it once on mount and invoke
// the cleanup on unmount, which is the shape every test relies on.
function useFocusEffect(callback) {
  React.useEffect(() => {
    const cleanup = callback();
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [callback]);
}

module.exports = {
  __esModule: true,
  router: routerSpy,
  useRouter,
  useLocalSearchParams,
  useSearchParams: useLocalSearchParams,
  useSegments,
  usePathname,
  useFocusEffect,
  Slot,
  Link,
  Tabs,
  Stack,
  // Re-export the spy so tests that need to assert navigation can
  // `jest.requireMock('expo-router').router.push.mock.calls`.
  __routerSpy: routerSpy,
  // Per-test helper: set the object `useLocalSearchParams()` returns.
  // S4 conversation screen reads `{conversationId}` from the URL; tests
  // need to plant that value before the screen renders.
  __setParams: (next) => {
    currentParams = next;
  },
};
