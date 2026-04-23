/**
 * Shared test helpers for atom-level component tests.
 *
 * These exist because `@testing-library/react-native` relies on RN host
 * component detection that our thin `react-native` stub doesn't provide.
 * We therefore walk the raw `react-test-renderer` tree directly.
 *
 * File lives in `src/components/ui` (not `__tests__`) so jest's module
 * resolver finds it via the same `@/components/ui` barrel search consumers
 * use; moving it to `__tests__` would require another alias entry.
 */

import type { ReactTestInstance } from 'react-test-renderer';

/** Flatten the potentially-nested `style` array RN components ship. */
export function flattenStyle(
  style: unknown,
): Record<string, string | number | undefined> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
  }
  return style as Record<string, string | number | undefined>;
}

/**
 * Resolve the *host* node that carries a given `testID` prop. When an
 * atom like Stack sets `testID` on its outer `<View>`, `findAllByProps`
 * returns three matches: the atom's React function component, the
 * host stub's forwardRef, and the final string-tag host node. Only the
 * last one has the `style` prop that lands on the renderer. We walk the
 * match list and pick the one whose `type` is a string (= host).
 */
export function findHostByTestID(
  root: ReactTestInstance,
  testID: string,
): ReactTestInstance {
  const matches = root.findAllByProps({ testID });
  const host = matches.find((m) => typeof m.type === 'string');
  if (!host) {
    throw new Error(`No host node found for testID "${testID}"`);
  }
  return host;
}

/** Shorthand — return the host node's `style` prop for the given testID. */
export function getHostStyleByTestID(
  root: ReactTestInstance,
  testID: string,
): unknown {
  return findHostByTestID(root, testID).props.style;
}
