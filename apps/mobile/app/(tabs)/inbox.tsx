/**
 * Inbox tab — S4 chat inbox screen.
 *
 * Mobile port of `apps/pwa/src/components/chat-inbox-screen.tsx`. The PWA
 * version renders a TopBar + dual section (requests + chats) with URL-driven
 * tabs; the mobile port shrinks the surface area because the (tabs) layout
 * already owns navigation chrome:
 *
 *   1. Anonymous gate: EmptyState with a "Verify to receive messages" CTA
 *      that routes to `/verify` via expo-router.
 *   2. Verified user: a `FlatList` of conversations sorted by
 *      `last_activity_at` (server already returns them in that order — we
 *      only re-sort defensively so a mid-flight insert doesn't land at the
 *      wrong position).
 *   3. Tap a row → `router.push('/conversations/{conversationId}')`.
 *
 * Contact requests live on their own screen (`/contact-requests`) reached
 * from a header button + the TopBar tab badge (wave S4-4) — splitting them
 * keeps the main inbox focused on chats, which is the more common
 * destination.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Banner,
  Button,
  EmptyState,
  PageHeader,
  Skeleton,
  Stack,
  Tag,
} from '@/components/ui';
import {
  useAppSelector,
  useContactRequestsInbox,
  useConversations,
} from '@/lib/hooks';
import { getBiometricLockEnabled } from '@/lib/persistence';
import {
  selectIsVerified,
  selectPreferencesLanguage,
  selectSession,
} from '@/lib/selectors';
import type { ConversationSummary } from '@/lib/types';
import { authenticateBiometric } from '@/lib/use-biometric-unlock';
import { useAppTheme } from '@/theme';

/**
 * Format a conversation's last-activity timestamp as a short relative label
 * (e.g. "5 min ago", "Yesterday", "Mar 12") using the user's preferred locale
 * so the right-side time chip stays scannable in every language.
 */
function formatConversationTime(value: string, locale: string): string {
  const date = new Date(value);
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60_000);

  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      diffMinutes,
      'minute',
    );
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      diffHours,
      'hour',
    );
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      diffDays,
      'day',
    );
  }

  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
}

function resolveIntlLocale(language: string): string {
  if (language === 'es') return 'es-US';
  if (language === 'zh') return 'zh-CN';
  return 'en-US';
}

export default function InboxTab() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation('chat');
  const session = useAppSelector(selectSession);
  const isVerified = useAppSelector(selectIsVerified);
  const language = useAppSelector(selectPreferencesLanguage);
  const locale = resolveIntlLocale(language);

  // Biometric lock state — `null` while we check the persisted flag; once
  // we know the user has opted in, `locked=true` blocks the conversation
  // list until `authenticateBiometric` resolves true. Tapping the unlock
  // button retries the prompt. If the OS prompt is declined we keep the
  // locked state so the list never flashes.
  const [locked, setLocked] = useState<boolean | null>(null);
  const authInFlight = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (authInFlight.current) return;
    authInFlight.current = true;
    try {
      const ok = await authenticateBiometric(t('unlockReason'));
      setLocked(!ok);
    } finally {
      authInFlight.current = false;
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (!isVerified || !session?.access_token) {
          // Gate is only meaningful for verified, signed-in users.
          if (!cancelled) setLocked(false);
          return;
        }
        const enabled = await getBiometricLockEnabled();
        if (cancelled) return;
        if (!enabled) {
          setLocked(false);
          return;
        }
        setLocked(true);
        const ok = await authenticateBiometric(t('unlockReason'));
        if (cancelled) return;
        setLocked(!ok);
      })();
      return () => {
        cancelled = true;
      };
    }, [isVerified, session?.access_token, t]),
  );

  const conversationsQuery = useConversations(
    session?.access_token,
    { limit: 20 },
    isVerified && Boolean(session?.access_token) && locked === false,
  );
  // Pull requests too so the header badge / CTA row reads the correct
  // pending count without a second round-trip. Cheap — same short
  // `staleTime` as the main query.
  const requestsQuery = useContactRequestsInbox(
    session?.access_token,
    { limit: 20 },
    isVerified && Boolean(session?.access_token) && locked === false,
    15_000,
  );

  const conversations = [...(conversationsQuery.data?.items ?? [])].sort(
    (a, b) =>
      new Date(b.last_activity_at).getTime() -
      new Date(a.last_activity_at).getTime(),
  );
  const pendingCount = (requestsQuery.data?.items ?? []).filter(
    (item) => item.status === 'pending',
  ).length;

  const handleOpenConversation = useCallback(
    (conversationId: string) => {
      router.push(`/conversations/${conversationId}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ConversationSummary>) => {
      const otherParticipant =
        item.participant_preview.find(
          (participant) => participant.user_id !== session?.user.user_id,
        ) ?? item.participant_preview[0];
      const displayName =
        otherParticipant?.alias ?? t('chatThreadFallbackAlias');
      const preview =
        item.last_message_preview ??
        t('inboxPendingPreview', {
          title: item.related_post_ids[0] ?? item.contact_request_id,
        });

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('inboxOpenThread')}
          onPress={() => handleOpenConversation(item.conversation_id)}
          testID={`inbox-conversation-${item.conversation_id}`}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: pressed
                ? (theme.colors.surfaceSunken as string)
                : (theme.colors.surface as string),
              borderBottomColor: theme.colors.border as string,
              paddingHorizontal: theme.spacing.m as number,
              paddingVertical: theme.spacing.s as number,
              gap: theme.spacing.s as number,
            },
          ]}
        >
          <Avatar name={displayName} size="md" />
          <View style={styles.rowBody}>
            <View style={styles.rowHeader}>
              <Text
                numberOfLines={1}
                style={[
                  styles.name,
                  {
                    color: theme.colors.inkPrimary as string,
                    fontSize: theme.textVariants.h4.fontSize as number,
                    lineHeight: theme.textVariants.h4.lineHeight as number,
                    fontWeight: theme.textVariants.h4
                      .fontWeight as '600',
                  },
                ]}
              >
                {displayName}
              </Text>
              <Text
                style={{
                  color: theme.colors.inkMuted as string,
                  fontSize: theme.textVariants.label.fontSize as number,
                  lineHeight: theme.textVariants.label.lineHeight as number,
                  marginLeft: theme.spacing.s as number,
                }}
              >
                {formatConversationTime(item.last_activity_at, locale)}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.inkSecondary as string,
                fontSize: theme.textVariants.bodySmall.fontSize as number,
                lineHeight: theme.textVariants.bodySmall.lineHeight as number,
                marginTop: theme.spacing.xs as number,
              }}
            >
              {preview}
            </Text>
            {item.unread_count > 0 ? (
              <View style={{ marginTop: theme.spacing.xs as number, alignSelf: 'flex-start' }}>
                <Tag tone="urgent">
                  {t('inboxUnreadBadge', { count: item.unread_count })}
                </Tag>
              </View>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [handleOpenConversation, locale, session?.user.user_id, t, theme],
  );

  // --- Anonymous gate ----------------------------------------------------
  if (!session || !isVerified) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.bg as string,
            paddingTop: (insets.top as number) + (theme.spacing.l as number),
            paddingHorizontal: theme.spacing.m as number,
          },
        ]}
        testID="inbox-screen"
      >
        <PageHeader title={t('inboxTitle')} testID="inbox-header" />
        <EmptyState
          illustrationName="error"
          title={t('inboxNeedsVerified')}
          cta={{
            label: t('inboxVerifyAction'),
            variant: 'primary',
            onPress: () => router.push('/verify'),
            testID: 'inbox-verify-cta',
          }}
          testID="inbox-unverified"
        />
      </View>
    );
  }

  // --- Biometric lock gate ----------------------------------------------
  // While we're still checking the persisted flag (`locked === null`) we
  // render a quiet skeleton so the list doesn't flash unlocked. When we
  // know the inbox is locked we show a "Tap to unlock" CTA that re-prompts
  // the OS biometric sheet.
  if (locked === true) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.bg as string,
            paddingTop: (insets.top as number) + (theme.spacing.l as number),
            paddingHorizontal: theme.spacing.m as number,
          },
        ]}
        testID="inbox-screen"
      >
        <PageHeader title={t('inboxTitle')} testID="inbox-header" />
        <View
          style={{ alignItems: 'center', paddingTop: theme.spacing.xl as number }}
          testID="inbox-locked"
        >
          <Button
            testID="inbox-unlock-cta"
            variant="primary"
            size="lg"
            onPress={() => {
              void tryUnlock();
            }}
          >
            {t('inboxLocked')}
          </Button>
        </View>
      </View>
    );
  }

  if (locked === null) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.bg as string,
            paddingTop: (insets.top as number) + (theme.spacing.l as number),
            paddingHorizontal: theme.spacing.m as number,
          },
        ]}
        testID="inbox-screen"
      >
        <PageHeader title={t('inboxTitle')} testID="inbox-header" />
      </View>
    );
  }

  // --- Verified: chat list ----------------------------------------------
  const isLoading = conversationsQuery.isLoading;
  const isError = conversationsQuery.isError;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg as string,
          paddingTop: (insets.top as number) + (theme.spacing.l as number),
        },
      ]}
      testID="inbox-screen"
    >
      <View style={{ paddingHorizontal: theme.spacing.m as number }}>
        <PageHeader title={t('inboxTitle')} testID="inbox-header" />
        <Stack gap="s">
          {pendingCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('inboxRequestsTitle')}
              onPress={() => router.push('/contact-requests')}
              testID="inbox-contact-requests-cta"
              style={({ pressed }) => [
                styles.requestsCta,
                {
                  backgroundColor: pressed
                    ? (theme.colors.accent as string)
                    : (theme.colors.accentSoft as string),
                  borderRadius: theme.borderRadii!.md as number,
                  padding: theme.spacing.sm as number,
                  gap: theme.spacing.s as number,
                },
              ]}
            >
              <Ionicons
                name="person-add-outline"
                size={18}
                color={theme.colors.accent as string}
              />
              <Text
                style={{
                  color: theme.colors.inkPrimary as string,
                  fontSize: theme.textVariants.body.fontSize as number,
                  flex: 1,
                }}
              >
                {t('inboxPendingCount', { count: pendingCount })}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.colors.inkMuted as string}
              />
            </Pressable>
          ) : null}
          {isError ? (
            <Banner
              tone="danger"
              title={t('sendFailedTitle')}
              actionLabel={t('sendFailedRetry')}
              onAction={() => void conversationsQuery.refetch()}
              testID="inbox-error-banner"
            />
          ) : null}
        </Stack>
      </View>

      {isLoading ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.m as number,
            paddingTop: theme.spacing.m as number,
            gap: theme.spacing.s as number,
          }}
          testID="inbox-loading"
        >
          <Skeleton variant="rect" height={72} />
          <Skeleton variant="rect" height={72} />
          <Skeleton variant="rect" height={72} />
        </View>
      ) : conversations.length === 0 && !isError ? (
        <View style={{ paddingHorizontal: theme.spacing.m as number }}>
          <EmptyState
            illustrationName="inbox-empty"
            title={t('inboxChatsEmpty')}
            testID="inbox-empty"
          />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.conversation_id}
          renderItem={renderItem}
          testID="inbox-list"
          contentContainerStyle={{
            paddingTop: theme.spacing.s as number,
            paddingBottom: (insets.bottom as number) + (theme.spacing.l as number),
          }}
          refreshing={conversationsQuery.isRefetching}
          onRefresh={() => {
            void conversationsQuery.refetch();
            void requestsQuery.refetch();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
  requestsCta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
