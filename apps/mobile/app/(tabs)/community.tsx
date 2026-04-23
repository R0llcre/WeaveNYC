/**
 * CommunityTab — mobile port of `apps/pwa/src/components/community-screen.tsx`.
 *
 * Two rendering modes, keyed off whether the user has joined any community:
 *
 *   1. *No membership* — hero Card with a "Join a community" CTA plus a
 *      3-row public posts preview (sourced from the seeded personas in
 *      `SEED_PUBLIC_POSTS`) so a first-time visitor sees what the feed
 *      will look like once they join.
 *   2. *Joined* — announcements card (`useCommunityAnnouncements`) +
 *      recent posts feed (`usePosts` with `scope: 'community'`). Each
 *      post is a Card row with title, body preview, type/category Tags.
 *
 * The Redux and data wiring mirror the PWA version but the P2P sync UI is
 * deferred — a later wave ports the full `useCommunityP2PSync` status card.
 *
 * Navigation:
 *   - Tap "Join a community" → `/community/join`
 *   - Tap "New post" → `/posts/new`
 *   - Tap a post row → `/posts/<id>`
 */

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
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
} from '@/components/ui';
import {
  useAppSelector,
  useCommunityAnnouncements,
  usePosts,
} from '@/lib/hooks';
import { SEED_PUBLIC_POSTS } from '@/lib/seed-activity';
import {
  selectCommunity,
  selectSession,
} from '@/lib/selectors';
import { useAppTheme } from '@/theme';
import type { PostSummary } from '@/lib/types';

export default function CommunityTab() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation(['community', 'posts', 'chrome', 'tickers']);

  const session = useAppSelector(selectSession);
  const communityState = useAppSelector(selectCommunity);

  const currentCommunityId = communityState.currentCommunityId;
  const joined = communityState.joinedCommunities;
  const hasMembership = joined.length > 0 && Boolean(currentCommunityId);

  // The active community summary — used to render the joined-state header
  // (name chip, zip footnote). Derived from the community slice, not a
  // network call.
  const currentCommunity = useMemo(() => {
    return joined.find((entry) => entry.community.community_id === currentCommunityId) ?? null;
  }, [joined, currentCommunityId]);

  const postsQuery = usePosts(
    session?.access_token,
    {
      scope: 'community',
      communityId: currentCommunityId ?? undefined,
      limit: 10,
    },
    hasMembership,
  );
  const announcementsQuery = useCommunityAnnouncements(
    session?.access_token,
    currentCommunityId,
    hasMembership,
  );

  const items: PostSummary[] = postsQuery.data?.items ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg as string }}
      contentContainerStyle={{
        paddingTop: (insets.top as number) + (theme.spacing.s as number),
        paddingBottom: (insets.bottom as number) + (theme.spacing.xl as number),
        paddingHorizontal: theme.spacing.l as number,
      }}
      testID="community-screen"
    >
      <PageHeader title={t('community:communityTitle')} />

      {!hasMembership ? (
        <Stack gap="l">
          <Card padding="l" variant="elevated">
            <Stack gap="m">
              <Text
                style={{
                  color: theme.colors.inkPrimary as string,
                  fontSize: theme.textVariants.h2.fontSize as number,
                  lineHeight: theme.textVariants.h2.lineHeight as number,
                  fontWeight: '600',
                }}
              >
                {t('community:communityTitle')}
              </Text>
              <Text
                style={{
                  color: theme.colors.inkSecondary as string,
                  fontSize: theme.textVariants.body.fontSize as number,
                  lineHeight: theme.textVariants.body.lineHeight as number,
                }}
              >
                {t('community:communityCopy')}
              </Text>
              <Button
                variant="primary"
                size="lg"
                onPress={() => router.push('/community/join')}
                testID="join-community"
              >
                {t('community:joinCommunityCta')}
              </Button>
            </Stack>
          </Card>

          <Stack gap="s">
            <Text
              style={{
                color: theme.colors.inkPrimary as string,
                fontSize: theme.textVariants.h3.fontSize as number,
                lineHeight: theme.textVariants.h3.lineHeight as number,
                fontWeight: '600',
              }}
            >
              {t('community:communityFeedHeading')}
            </Text>

            {SEED_PUBLIC_POSTS.map((post) => (
              <Card key={post.id} padding="m" variant="flat">
                <Stack gap="xs">
                  <Inline gap="xs">
                    <Tag tone="info">{String(post.category)}</Tag>
                    <Tag tone="neutral">{post.community}</Tag>
                  </Inline>
                  <Text
                    style={{
                      color: theme.colors.inkPrimary as string,
                      fontSize: theme.textVariants.body.fontSize as number,
                      lineHeight: theme.textVariants.body.lineHeight as number,
                      fontWeight: '500',
                    }}
                  >
                    {post.name}
                  </Text>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Stack>
      ) : (
        <Stack gap="l">
          <Card padding="l" variant="elevated" testID="current-community-card">
            <Stack gap="s">
              <Inline gap="s">
                <Tag tone="verified">
                  {currentCommunity?.community.name ?? ''}
                </Tag>
                <Tag tone="neutral">
                  {currentCommunity?.community.center_zip ?? ''}
                </Tag>
              </Inline>
              <Button
                variant="primary"
                onPress={() => router.push('/posts/new')}
                testID="new-post-cta"
              >
                {t('posts:composeTitle')}
              </Button>
            </Stack>
          </Card>

          <Stack gap="s">
            <Text
              style={{
                color: theme.colors.inkPrimary as string,
                fontSize: theme.textVariants.h3.fontSize as number,
                lineHeight: theme.textVariants.h3.lineHeight as number,
                fontWeight: '600',
              }}
            >
              {t('community:communityAnnouncementsHeading')}
            </Text>

            {announcementsQuery.isLoading ? (
              <Skeleton height={60} />
            ) : announcementsQuery.data && announcementsQuery.data.items.length > 0 ? (
              announcementsQuery.data.items.slice(0, 3).map((a) => (
                <Banner key={a.announcement_id} tone="info" title={a.title}>
                  {a.body}
                </Banner>
              ))
            ) : (
              <Text style={{ color: theme.colors.inkMuted as string }}>
                {t('community:communityAnnouncementsEmpty')}
              </Text>
            )}
          </Stack>

          <Stack gap="s">
            <Text
              style={{
                color: theme.colors.inkPrimary as string,
                fontSize: theme.textVariants.h3.fontSize as number,
                lineHeight: theme.textVariants.h3.lineHeight as number,
                fontWeight: '600',
              }}
            >
              {t('community:communityFeedHeading')}
            </Text>

            {postsQuery.isLoading ? (
              <Stack gap="s">
                <Skeleton height={60} />
                <Skeleton height={60} />
                <Skeleton height={60} />
              </Stack>
            ) : items.length === 0 ? (
              <EmptyState
                title={t('posts:postsEmpty')}
                subtitle={t('community:communityNoMembership')}
              />
            ) : (
              items.map((post) => (
                <Pressable
                  key={post.post_id}
                  onPress={() => router.push(`/posts/${post.post_id}`)}
                  testID={`post-row-${post.post_id}`}
                >
                  <Card padding="m" variant="flat">
                    <Stack gap="xs">
                      <Inline gap="xs">
                        <Tag tone={post.post_type === 'request' ? 'urgent' : 'verified'}>
                          {post.post_type}
                        </Tag>
                        <Tag tone="info">{post.category}</Tag>
                      </Inline>
                      <Text
                        style={{
                          color: theme.colors.inkPrimary as string,
                          fontSize: theme.textVariants.body.fontSize as number,
                          lineHeight: theme.textVariants.body.lineHeight as number,
                          fontWeight: '500',
                        }}
                      >
                        {post.title}
                      </Text>
                      <Text
                        style={{
                          color: theme.colors.inkMuted as string,
                          fontSize: theme.textVariants.micro.fontSize as number,
                          lineHeight: theme.textVariants.micro.lineHeight as number,
                        }}
                        numberOfLines={2}
                      >
                        {post.body}
                      </Text>
                    </Stack>
                  </Card>
                </Pressable>
              ))
            )}
          </Stack>
        </Stack>
      )}
    </ScrollView>
  );
}
