/**
 * Contact requests — S4 pending-request inbox.
 *
 * Mobile port of `apps/pwa/src/components/contact-inbox-screen.tsx` — the
 * PWA version reuses ChatInboxScreen with `initialView="requests"`; on
 * mobile we split the two tabs into two screens because the bottom tab
 * bar already owns one of the roles. This screen is reached from the
 * inbox tab's "N waiting" CTA and from a deep link.
 *
 * Actions:
 *   - Accept → calls `useAcceptContactRequest`, then (on success with a
 *     conversation_id) routes to `/conversations/{conversationId}`.
 *   - Decline → calls `useRejectContactRequest` so the item drops out of
 *     the list on the next refetch.
 */

import { useRouter } from 'expo-router';
import { useCallback } from 'react';
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
  Inline,
  PageHeader,
  Skeleton,
  Stack,
  Tag,
} from '@/components/ui';
import {
  useAcceptContactRequest,
  useAppSelector,
  useContactRequestsInbox,
  useRejectContactRequest,
} from '@/lib/hooks';
import {
  selectIsVerified,
  selectPreferencesLanguage,
  selectSession,
} from '@/lib/selectors';
import type { ContactRequestInboxItem } from '@/lib/types';
import { useAppTheme } from '@/theme';

function resolveIntlLocale(language: string): string {
  if (language === 'es') return 'es-US';
  if (language === 'zh') return 'zh-CN';
  return 'en-US';
}

export default function ContactRequestsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation('chat');
  const session = useAppSelector(selectSession);
  const isVerified = useAppSelector(selectIsVerified);
  const language = useAppSelector(selectPreferencesLanguage);
  const locale = resolveIntlLocale(language);

  const requestsQuery = useContactRequestsInbox(
    session?.access_token,
    { limit: 20 },
    isVerified && Boolean(session?.access_token),
    15_000,
  );
  const acceptMutation = useAcceptContactRequest(session?.access_token);
  const rejectMutation = useRejectContactRequest(session?.access_token);

  const requests = (requestsQuery.data?.items ?? []).filter(
    (item) => item.status === 'pending',
  );
  const busy = acceptMutation.isPending || rejectMutation.isPending;

  const handleAccept = useCallback(
    async (item: ContactRequestInboxItem) => {
      try {
        const result = await acceptMutation.mutateAsync(
          item.contact_request_id,
        );
        if (result.conversation_id) {
          router.push(`/conversations/${result.conversation_id}`);
        }
      } catch {
        // Mutation error state drives the banner below.
      }
    },
    [acceptMutation, router],
  );

  const handleDecline = useCallback(
    async (item: ContactRequestInboxItem) => {
      try {
        await rejectMutation.mutateAsync(item.contact_request_id);
      } catch {
        // Same — banner surface.
      }
    },
    [rejectMutation],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ContactRequestInboxItem>) => (
      <View
        style={[
          styles.row,
          {
            backgroundColor: theme.colors.surface as string,
            borderColor: theme.colors.border as string,
            borderRadius: theme.borderRadii!.md as number,
            padding: theme.spacing.m as number,
            marginBottom: theme.spacing.s as number,
            gap: theme.spacing.s as number,
          },
        ]}
        testID={`contact-request-${item.contact_request_id}`}
      >
        <Inline gap="s" align="start">
          <Avatar name={item.requester_alias} size="md" />
          <View style={styles.rowBody}>
            <Text
              style={{
                color: theme.colors.inkPrimary as string,
                fontSize: theme.textVariants.h4.fontSize as number,
                fontWeight: theme.textVariants.h4.fontWeight as '600',
              }}
            >
              {item.requester_alias}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                color: theme.colors.inkSecondary as string,
                fontSize: theme.textVariants.bodySmall.fontSize as number,
                marginTop: theme.spacing.xs as number,
              }}
            >
              {item.from_post_title}
            </Text>
            <View style={{ marginTop: theme.spacing.xs as number, flexDirection: 'row' }}>
              <Tag tone="neutral">
                {t('inboxExpiresAt', {
                  value: new Intl.DateTimeFormat(locale, {
                    month: 'short',
                    day: 'numeric',
                  }).format(new Date(item.expires_at)),
                })}
              </Tag>
            </View>
          </View>
        </Inline>
        <Inline gap="s" wrap>
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onPress={() => void handleAccept(item)}
            testID={`contact-request-${item.contact_request_id}-accept`}
          >
            {t('inboxAccept')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onPress={() => void handleDecline(item)}
            testID={`contact-request-${item.contact_request_id}-decline`}
          >
            {t('contactInboxReject')}
          </Button>
        </Inline>
      </View>
    ),
    [busy, handleAccept, handleDecline, locale, t, theme],
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
        testID="contact-requests-screen"
      >
        <PageHeader
          title={t('inboxRequestsTitle')}
          onBack={() => router.back()}
          testID="contact-requests-header"
        />
        <EmptyState
          illustrationName="error"
          title={t('inboxNeedsVerified')}
          cta={{
            label: t('inboxVerifyAction'),
            variant: 'primary',
            onPress: () => router.push('/verify'),
          }}
          testID="contact-requests-unverified"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg as string,
          paddingTop: (insets.top as number) + (theme.spacing.l as number),
        },
      ]}
      testID="contact-requests-screen"
    >
      <View style={{ paddingHorizontal: theme.spacing.m as number }}>
        <PageHeader
          title={t('inboxRequestsTitle')}
          onBack={() => router.back()}
          testID="contact-requests-header"
        />
        <Stack gap="s">
          <Text
            style={{
              color: theme.colors.inkSecondary as string,
              fontSize: theme.textVariants.bodySmall.fontSize as number,
            }}
          >
            {t('inboxRequestsCopy')}
          </Text>
          {requestsQuery.isError ? (
            <Banner
              tone="danger"
              title={t('sendFailedTitle')}
              actionLabel={t('sendFailedRetry')}
              onAction={() => void requestsQuery.refetch()}
              testID="contact-requests-error"
            />
          ) : null}
        </Stack>
      </View>

      {requestsQuery.isLoading ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.m as number,
            paddingTop: theme.spacing.m as number,
            gap: theme.spacing.s as number,
          }}
          testID="contact-requests-loading"
        >
          <Skeleton variant="rect" height={120} />
          <Skeleton variant="rect" height={120} />
        </View>
      ) : requests.length === 0 ? (
        <View style={{ paddingHorizontal: theme.spacing.m as number }}>
          <EmptyState
            illustrationName="inbox-empty"
            title={t('inboxRequestsEmpty')}
            testID="contact-requests-empty"
          />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.contact_request_id}
          renderItem={renderItem}
          testID="contact-requests-list"
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.m as number,
            paddingTop: theme.spacing.s as number,
            paddingBottom: (insets.bottom as number) + (theme.spacing.l as number),
          }}
          refreshing={requestsQuery.isRefetching}
          onRefresh={() => void requestsQuery.refetch()}
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
});
