/**
 * Avatar atom — unit tests.
 *
 * Locks three behaviours we'd rather not regress silently:
 *   1. Name-based initials heuristic — "Kai Ryan" → "KR" uppercase.
 *   2. Deterministic tone pick — the SAME name always yields the same
 *      background across renders (the hash-from-name contract the PWA
 *      also honours, critical for cross-session recognition).
 *   3. Source precedence — `uri` renders an Image and skips initials;
 *      a missing name+uri renders the fallback silhouette disk.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';

import { Avatar } from './Avatar';

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

// RN host components emit their style prop as an array of objects. Pull out
// the object that carries `backgroundColor` so the two-render comparison
// below works regardless of style merging order.
function backgroundOf(node: { props: Record<string, unknown> }): string | undefined {
  const raw = (node.props as { style: unknown }).style;
  const arr = Array.isArray(raw) ? raw : [raw];
  for (const layer of arr) {
    if (layer && typeof layer === 'object' && 'backgroundColor' in (layer as object)) {
      return (layer as { backgroundColor: string }).backgroundColor;
    }
  }
  return undefined;
}

describe('<Avatar />', () => {
  test('renders uppercase initials monogram from display name', () => {
    renderWithTheme(<Avatar name="Kai Ryan" testID="a1" />);
    const initials = screen.getByTestId('a1-initials');
    // Host components expose children via `props.children`; the monogram
    // is a plain string — toBe-compare with the uppercased form.
    expect(initials.props.children).toBe('KR');
  });

  test('same name → same background tone across renders (deterministic hash)', () => {
    const { unmount } = renderWithTheme(<Avatar name="Mei Wang" testID="run1" />);
    const firstBg = backgroundOf(screen.getByTestId('run1'));
    unmount();

    renderWithTheme(<Avatar name="Mei Wang" testID="run2" />);
    const secondBg = backgroundOf(screen.getByTestId('run2'));

    // Same display name must land on the same tone — otherwise users'
    // avatars flicker between sessions, which breaks recognition.
    expect(firstBg).toBeDefined();
    expect(firstBg).toBe(secondBg);
  });

  test('uri renders Image; missing name + no uri renders fallback disk', () => {
    renderWithTheme(<Avatar uri="https://example.test/a.png" name="X" testID="img" />);
    expect(screen.getByTestId('img-image')).toBeDefined();
    expect(screen.queryByTestId('img-initials')).toBeNull();

    renderWithTheme(<Avatar testID="empty" />);
    expect(screen.getByTestId('empty-fallback')).toBeDefined();
    expect(screen.queryByTestId('empty-initials')).toBeNull();
  });
});
