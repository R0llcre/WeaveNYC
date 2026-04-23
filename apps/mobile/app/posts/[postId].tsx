/**
 * Post detail — mobile port of
 * `apps/pwa/src/components/post-detail-screen.tsx`.
 *
 * Layout:
 *   - Hero Card: type + category tags, title, body, ZIP chip, expiry chip.
 *   - Owner actions (when `post.is_owner`): close + delete IconButtons and
 *     a "See matches" CTA.
 *   - Non-owner actions: a "Contact" CTA that routes to `/posts/:id/matches`
 *     (the PWA surfaces the matchmaker for both owner and requester from
 *     this screen; mobile does the same).
 *
 * The edit mode is deferred — a later wave ports the inline edit form.
 * This screen covers the 80% read-path and the owner close / delete
 * intents that the community feed links into.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text } from 'react-native';
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
  useClosePost,
  useDeletePost,
  usePost,
} from '@/lib/hooks';
import { selectSession } from '@/lib/selectors';
import { useAppTheme } from '@/theme';

export default function PostDetailScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation(['posts', 'community', 'chrome', 'errors']);
  const params = useLocalSearchParams<{ postId: string }>();
  const postId = params.postId ?? '';

  const session = useAppSelector(selectSession);
  const postQuery = usePost(session?.access_token, postId, Boolean(postId));
  const closeMutation = useClosePost(session?.access_token);
  const deleteMutation = useDeletePost(session?.access_token);

  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'danger'>('success');

  const post = postQuery.data;

  const onClose = async () => {
    if (!post) return;
    try {
      await closeMutation.mutateAsync(post.post_id);
      setToastTone('success');
      setToast(
        t('posts:postClosedToast', { defaultValue: 'Closed' }),
      );
    } catch (err) {
      setToastTone('danger');
      setToast((err as Error)?.message ?? 'Error');
    }
  };

  const onDelete = async () => {
    if (!post) return;
    try {
      await deleteMutation.mutateAsync(post.post_id);
      setTimeout(() => router.back(), 400);
    } catch (err) {
      setToastTone('danger');
      setToast((err as Error)?.message ?? 'Error');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg as string }}
      contentContainerStyle={{
        paddingTop: (insets.top as number) + (theme.spacing.s as number),
        paddingBottom: (insets.bottom as number) + (theme.spacing.xl as number),
        paddingHorizontal: theme.spacing.l as number,
      }}
      testID="post-detail-screen"
    >
      <PageHeader
        title={t('posts:postDetailTitle')}
        onBack={() => router.back()}
      />

      {postQuery.isLoading ? (
        <Skeleton height={220} />
      ) : postQuery.isError || !post ? (
        <EmptyState
          title={t('errors:errorUnknown', { defaultValue: 'Could not load' })}
          subtitle={(postQuery.error as Error)?.message ?? ''}
        />
      ) : (
        <Stack gap="l">
          <Card padding="l" variant="elevated">
            <Stack gap="s">
              <Inline gap="xs">
                <Tag tone={post.post_type === 'request' ? 'urgent' : 'verified'}>
                  {post.post_type}
                </Tag>
                <Tag tone="info">{post.category}</Tag>
                <Tag tone="neutral">{post.location_zip}</Tag>
              </Inline>

              <Text
                style={{
                  color: theme.colors.inkPrimary as string,
                  fontSize: theme.textVariants.h2.fontSize as number,
                  lineHeight: theme.textVariants.h2.lineHeight as number,
                  fontWeight: '600',
                }}
              >
                {post.title}
              </Text>

              <Text
                style={{
                  color: theme.colors.inkSecondary as string,
                  fontSize: theme.textVariants.body.fontSize as number,
                  lineHeight: theme.textVariants.body.lineHeight as number,
                }}
              >
                {post.body}
              </Text>

              <Text
                style={{
                  color: theme.colors.inkMuted as string,
                  fontSize: theme.textVariants.micro.fontSize as number,
                  lineHeight: theme.textVariants.micro.lineHeight as number,
                }}
              >
                {t('posts:postExpiresAt', { defaultValue: 'Expires' })}: {post.expires_at}
              </Text>
            </Stack>
          </Card>

          {post.is_owner ? (
            <Stack gap="s">
              <Button
                variant="primary"
                onPress={() => router.push(`/posts/${post.post_id}/matches`)}
                testID="see-matches"
              >
                {t('posts:postMatchesCta', { defaultValue: 'See matches' })}
              </Button>
              <Inline gap="s">
                <Button
                  variant="secondary"
                  onPress={onClose}
                  loading={closeMutation.isPending}
                  testID="close-post"
                >
                  {t('posts:postCloseAction', { defaultValue: 'Close' })}
                </Button>
                <Button
                  variant="danger"
                  onPress={onDelete}
                  loading={deleteMutation.isPending}
                  testID="delete-post"
                >
                  {t('posts:postDeleteAction', { defaultValue: 'Delete' })}
                </Button>
              </Inline>
              {post.status === 'closed' || post.status === 'removed' ? (
                <Banner
                  tone="warning"
                  title={t('posts:postStatusClosed', { defaultValue: 'Closed' })}
                />
              ) : null}
            </Stack>
          ) : (
            <Button
              variant="primary"
              onPress={() => router.push(`/posts/${post.post_id}/matches`)}
              testID="contact-owner"
            >
              {t('posts:postContactCta', { defaultValue: 'Contact' })}
            </Button>
          )}
        </Stack>
      )}

      {toast ? (
        <Toast
          tone={toastTone}
          message={toast}
          onDismiss={() => setToast(null)}
          dismissLabel={t('chrome:dismiss', { defaultValue: 'Dismiss' })}
        />
      ) : null}
    </ScrollView>
  );
}
