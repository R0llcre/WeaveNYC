/**
 * InboxTabBadge — small pending-requests count badge rendered on top of
 * the Inbox tab icon.
 *
 * Mobile port of `apps/pwa/src/components/contact-inbox-link.tsx`. The PWA
 * renders a standalone Button with a badge in its trailingIcon slot; on
 * mobile the affordance lives directly inside the bottom tab bar, layered
 * over the Ionicons `mail-outline` glyph, so the count is visible without
 * navigating away from the current screen.
 *
 * Data source: `useContactRequestsInbox` — the same query the inbox
 * screen uses, so both surfaces share a cache entry and the badge updates
 * immediately after an accept/decline mutation invalidates `['inbox']`.
 */

import { StyleSheet, Text, View } from 'react-native';

import { useAppSelector, useContactRequestsInbox } from '@/lib/hooks';
import {
  selectIsVerified,
  selectSession,
} from '@/lib/selectors';
import { useAppTheme } from '@/theme';

export interface InboxTabBadgeProps {
  /** Optional tintable colour. Defaults to the theme's `accent`. */
  color?: string;
  testID?: string;
}

export function InboxTabBadge({ color, testID }: InboxTabBadgeProps) {
  const theme = useAppTheme();
  const session = useAppSelector(selectSession);
  const isVerified = useAppSelector(selectIsVerified);
  const requestsQuery = useContactRequestsInbox(
    session?.access_token,
    { limit: 10 },
    isVerified && Boolean(session?.access_token),
    20_000,
  );
  const pendingCount =
    isVerified && requestsQuery.data
      ? requestsQuery.data.items.filter((item) => item.status === 'pending')
          .length
      : 0;

  if (!isVerified || pendingCount <= 0) {
    return null;
  }

  const display = pendingCount > 9 ? '9+' : String(pendingCount);
  const bg = color ?? (theme.colors.accent as string);

  return (
    <View
      testID={testID ?? 'inbox-tab-badge'}
      accessible
      accessibilityLabel={String(pendingCount)}
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: theme.colors.surfaceRaised as string,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: theme.colors.accentInk as string },
        ]}
      >
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
