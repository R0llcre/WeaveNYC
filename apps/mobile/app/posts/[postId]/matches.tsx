/**
 * Match results — mobile port of
 * `apps/pwa/src/components/match-results-screen.tsx`.
 *
 * Shows the list of candidate matches for a post (neighbour posts or
 * official resources). Each card shows the candidate title, score, distance
 * (when available) and a "Contact" CTA. A "Refresh" button re-runs the
 * matchmaker — shared mutation with the PWA so idempotency + throttle
 * semantics are identical.
 *
 * The PWA uses a `<ResourceCard>` for the neighbour post variant to share
 * the exact same row shape as the Home tab. Mobile swaps to a plain `<Card>`
 * for now — the ResourceCard atom's phone numbers + directions CTAs don't
 * fit the "neighbour post" shape cleanly, and a lighter card keeps the
 * match list readable on a 375pt screen.
 */

import { FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Banner,
  Button,
  Card,
  EmptyState,
  Inline,
  PageHeader,
  Skeleton,
  Stack,
  Tag,
  Toast,
} from '@/components/ui';
import {
  useAppSelector,
  useCreateMatchContact,
  useMatchSuggestions,
  useRefreshMatchSuggestions,
} from '@/lib/hooks';
import { selectSession } from '@/lib/selectors';
import { useAppTheme } from '@/theme';
import type { MatchSuggestion } from '@/lib/types';

export default function PostMatchesScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation(['posts', 'chrome', 'errors']);
  const params = useLocalSearchParams<{ postId: string }>();
  const postId = params.postId ?? '';

  const session = useAppSelector(selectSession);
  const matchesQuery = useMatchSuggestions(
    session?.access_token,
    postId,
    Boolean(postId),
  );
  const refreshMutation = useRefreshMatchSuggestions(session?.access_token, postId);
  const contactMutation = useCreateMatchContact(session?.access_token);

  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'danger'>('success');

  const onContact = async (match: MatchSuggestion) => {
    if (!match.neighbor_post) return;
    try {
      await contactMutation.mutateAsync({
        fromPostId: postId,
        toPostId: match.neighbor_post.post_id,
      });
      setToastTone('success');
      setToast(t('posts:matchContactSent', { defaultValue: 'Contact sent' }));
    } catch (err) {
      setToastTone('danger');
      setToast((err as Error)?.message ?? 'Error');
    }
  };

  const renderMatch = ({ item }: { item: MatchSuggestion }) => {
    const neighbour = item.neighbor_post;
    const resource = item.official_resource;
    const title = neighbour?.title ?? resource?.name ?? '';
    const body = neighbour?.body ?? resource?.type ?? '';

    return (
      <Card padding="m" variant="flat" testID={`match-${item.suggestion_id}`}>
        <Stack gap="xs">
          <Inline gap="xs">
            <Tag tone="verified">
              {Math.round(item.score * 100)}%
            </Tag>
            {item.distance_miles != null ? (
              <Tag tone="neutral">
                {item.distance_miles.toFixed(1)} mi
              </Tag>
            ) : null}
            <Tag tone="info">{item.candidate_type}</Tag>
          </Inline>

          <Text
            style={{
              color: theme.colors.inkPrimary as string,
              fontSize: theme.textVariants.body.fontSize as number,
              lineHeight: theme.textVariants.body.lineHeight as number,
              fontWeight: '500',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: theme.colors.inkMuted as string,
              fontSize: theme.textVariants.micro.fontSize as number,
              lineHeight: theme.textVariants.micro.lineHeight as number,
            }}
            numberOfLines={3}
          >
            {body}
          </Text>

          {neighbour ? (
            <Button
              variant="primary"
              size="sm"
              onPress={() => onContact(item)}
              loading={contactMutation.isPending}
              testID={`contact-${item.suggestion_id}`}
            >
              {t('posts:matchContactCta', { defaultValue: 'Contact' })}
            </Button>
          ) : null}
        </Stack>
      </Card>
    );
  };

  const items = matchesQuery.data?.items ?? [];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg as string,
        paddingTop: (insets.top as number) + (theme.spacing.s as number),
        paddingBottom: insets.bottom as number,
        paddingHorizontal: theme.spacing.l as number,
      }}
      testID="post-matches-screen"
    >
      <PageHeader
        title={t('posts:matchResultsTitle', { defaultValue: 'Matches' })}
        onBack={() => router.back()}
      />

      <Stack gap="s">
        <Inline gap="s">
          <Button
            variant="secondary"
            size="sm"
            onPress={() => {
              void refreshMutation.mutateAsync();
            }}
            loading={refreshMutation.isPending}
            testID="refresh-matches"
          >
            {t('posts:matchRefreshCta', { defaultValue: 'Refresh' })}
          </Button>
          {matchesQuery.data ? (
            <Text style={{ color: theme.colors.inkMuted as string }}>
              {matchesQuery.data.refreshes_used}/{matchesQuery.data.max_refreshes}
            </Text>
          ) : null}
        </Inline>
      </Stack>

      {matchesQuery.isLoading ? (
        <Stack gap="s">
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={100} />
        </Stack>
      ) : matchesQuery.isError ? (
        <Banner
          tone="danger"
          title={t('errors:errorUnknown', { defaultValue: 'Error' })}
        >
          {(matchesQuery.error as Error)?.message ?? ''}
        </Banner>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('posts:matchEmptyTitle', { defaultValue: 'No matches yet' })}
          subtitle={t('posts:matchEmptyDescription', {
            defaultValue: 'Try refreshing in a moment.',
          })}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.suggestion_id}
          renderItem={renderMatch}
          ItemSeparatorComponent={() => (
            <View style={{ height: theme.spacing.s as number }} />
          )}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl as number }}
          testID="match-list"
        />
      )}

      {toast ? (
        <Toast
          tone={toastTone}
          message={toast}
          onDismiss={() => setToast(null)}
          dismissLabel={t('chrome:dismiss', { defaultValue: 'Dismiss' })}
        />
      ) : null}
    </View>
  );
}
