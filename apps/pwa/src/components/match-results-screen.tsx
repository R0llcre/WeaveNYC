'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { TopBar } from '@/components/shell';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  IconButton,
  Inline,
  ResourceCard,
  Skeleton,
  Stack,
  Tag,
} from '@/components/ui';
import { createAnonymousSession } from '@/lib/api';
import {
  clearMatchContactIntent,
  loadMatchContactIntent,
  saveMatchContactIntent,
} from '@/lib/match-intent';
import {
  useAppDispatch,
  useAppSelector,
  useCreateMatchContact,
  useMatchSuggestions,
  usePost,
  useRefreshMatchSuggestions,
} from '@/lib/hooks';
import {
  getCategoryLabel,
  getMatchReasonLabel,
  getPostTypeLabel,
} from '@/lib/i18n';
import {
  selectIsVerified,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import { setSession } from '@/lib/slices/auth-slice';
import type { MatchContactResult, MatchSuggestion } from '@/lib/types';
import type { ResourceCardCategory } from '@/components/ui';

type MatchResultsScreenProps = {
  postId: string;
};

const FRESH_RESULTS_WINDOW_MS = 60_000;
const INTENT_CONSUMED_STORAGE_PREFIX = 'weavenyc.intent_consumed_';

function markIntentConsumed(intentKey: string): boolean {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return true;
  }
  const storageKey = `${INTENT_CONSUMED_STORAGE_PREFIX}${intentKey}`;
  try {
    if (window.sessionStorage.getItem(storageKey)) {
      return false;
    }
    window.sessionStorage.setItem(storageKey, '1');
    return true;
  } catch {
    return true;
  }
}

/**
 * W4A — Match results page.
 *
 * Layout:
 *   TopBar (back → /posts/:id)
 *   ── Header strip: refresh status tag + refresh button (secondary)
 *   ── Accepted-intent Banner (tone=info) when the verify flow sends the
 *      user back with a pending contact attempt
 *   ── Contact-sent Banner (tone=success) when a request goes through
 *   ── Match list: neighbor posts are small `<Card>` blocks with a primary
 *      "Contact" CTA; official resources use the `<ResourceCard>` atom so the
 *      affordances line up with the discover surface
 *   ── EmptyState when there are zero items (illustrationName="matches-empty")
 *   ── Skeleton list while loading
 *
 * All the original Redux / TanStack Query / intent-pump logic is preserved.
 */
export function MatchResultsScreen({ postId }: MatchResultsScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);
  const preferences = useAppSelector(selectPreferences);
  const [isCreatingSession, setCreatingSession] = useState(false);
  const [intent, setIntent] = useState(() => loadMatchContactIntent());
  const [resultOverride, setResultOverride] = useState<
    ReturnType<typeof useMatchSuggestions>['data'] | null
  >(null);
  const [contactResult, setContactResult] = useState<MatchContactResult | null>(null);
  const [submittedIntentKey, setSubmittedIntentKey] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeLanguage = preferences.language;
  const isVerified = useAppSelector(selectIsVerified);

  const postQuery = usePost(session?.access_token, postId, Boolean(session?.access_token));
  const matchesQuery = useMatchSuggestions(session?.access_token, postId, Boolean(session?.access_token));
  const refreshMutation = useRefreshMatchSuggestions(session?.access_token, postId);
  const contactMutation = useCreateMatchContact(session?.access_token);

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitleMatches')} \u2014 WeaveNYC`;
  }, [t]);

  useEffect(() => {
    setIntent(loadMatchContactIntent());
  }, [session?.user.level, pathname]);

  useEffect(() => {
    if (!isVerified || !intent || intent.kind !== 'match_contact') {
      return;
    }
    const intentKey = `${intent.fromPostId}:${intent.toPostId}:${intent.createdAt}`;
    if (submittedIntentKey === intentKey || contactMutation.isPending) {
      return;
    }
    if (intent.fromPostId !== postId) {
      return;
    }
    if (!markIntentConsumed(intentKey)) {
      clearMatchContactIntent();
      setIntent(null);
      setSubmittedIntentKey(intentKey);
      return;
    }
    setSubmittedIntentKey(intentKey);
    const submittedFromPostId = intent.fromPostId;
    const submittedToPostId = intent.toPostId;
    clearMatchContactIntent();
    setIntent(null);

    void contactMutation
      .mutateAsync({ fromPostId: submittedFromPostId, toPostId: submittedToPostId })
      .then((result) => {
        setContactResult(result);
        if (result.status === 'accepted' && result.conversation_id) {
          router.push(
            `/conversations/${result.conversation_id}?contact_request_id=${encodeURIComponent(result.contact_request_id)}`,
          );
        }
      })
      .catch(() => {
        setSubmittedIntentKey(null);
      });
  }, [contactMutation, intent, isVerified, postId, router, submittedIntentKey]);

  const activeResults = resultOverride ?? matchesQuery.data ?? null;
  const actionableIntent =
    intent?.kind === 'match_contact' && intent.fromPostId === postId ? intent : null;

  useEffect(() => {
    if (!activeResults) {
      return;
    }
    setIsStale(false);
    const stamp = Date.now();
    setLastRefreshedAt(stamp);
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
    }
    staleTimerRef.current = setTimeout(() => {
      setIsStale(true);
    }, FRESH_RESULTS_WINDOW_MS);
    return () => {
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
    };
  }, [activeResults]);

  useEffect(() => {
    return () => {
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
      setIsStale(true);
    };
  }, [pathname]);

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      dispatch(setSession(await createAnonymousSession()));
    } finally {
      setCreatingSession(false);
    }
  };

  const handleContact = async (suggestion: MatchSuggestion) => {
    const targetPost = suggestion.neighbor_post;
    if (!targetPost) {
      return;
    }
    const nextIntent = {
      kind: 'match_contact' as const,
      fromPostId: postId,
      toPostId: targetPost.post_id,
      targetTitle: targetPost.title,
      returnTo: pathname,
      createdAt: new Date().toISOString(),
    };
    if (!session) {
      setCreatingSession(true);
      try {
        dispatch(setSession(await createAnonymousSession()));
      } finally {
        setCreatingSession(false);
      }
      saveMatchContactIntent(nextIntent);
      setIntent(nextIntent);
      router.push(`/me/verify?return_to=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!isVerified) {
      saveMatchContactIntent(nextIntent);
      setIntent(nextIntent);
      router.push(`/me/verify?return_to=${encodeURIComponent(pathname)}`);
      return;
    }
    const result = await contactMutation.mutateAsync({
      fromPostId: postId,
      toPostId: targetPost.post_id,
    });
    setContactResult(result);
    clearMatchContactIntent();
    setIntent(null);
    if (result.status === 'accepted' && result.conversation_id) {
      router.push(
        `/conversations/${result.conversation_id}?contact_request_id=${encodeURIComponent(result.contact_request_id)}`,
      );
    }
  };

  const post = postQuery.data;
  const canShowMatches =
    !!post && post.is_owner && post.post_type === 'request' && post.status === 'active';
  const refreshesExhausted = activeResults
    ? activeResults.refreshes_used >= activeResults.max_refreshes
    : false;
  const canRefresh = activeResults
    ? !refreshesExhausted && !refreshMutation.isPending
    : false;
  const freshResultsVisible = Boolean(lastRefreshedAt) && !isStale && !refreshMutation.isPending;
  const staleResultsVisible = Boolean(lastRefreshedAt) && isStale && !refreshesExhausted;

  const refreshStatus = useMemo(() => {
    if (activeResults) {
      return t('matchRefreshStatus', {
        used: activeResults.refreshes_used,
        max: activeResults.max_refreshes,
      });
    }
    return null;
  }, [activeResults, t]);

  return (
    <>
      <TopBar
        variant="page"
        eyebrow={t('pageTitleMatches')}
        title={t('matchTitle')}
        backHref={`/posts/${postId}`}
      />
      <div className="page-content" data-screen="match-results">
        <Stack gap={5} as="section">
          <p className="muted">{t('matchCopy')}</p>

          {/* Anonymous visitor: keeps the create-session bootstrap path. */}
          {!session ? (
            <Card variant="raised">
              <Stack gap={3}>
                <Stack gap={1}>
                  <span className="overline">{t('sessionAnonymous')}</span>
                  <h2>{t('joinNeedsSession')}</h2>
                </Stack>
                <Inline gap={3} wrap>
                  <Button
                    disabled={isCreatingSession}
                    loading={isCreatingSession}
                    onClick={() => void handleCreateSession()}
                    variant="primary"
                  >
                    {isCreatingSession ? t('creatingSession') : t('createSession')}
                  </Button>
                </Inline>
              </Stack>
            </Card>
          ) : null}

          {/* Pending-intent banner returning from /me/verify. */}
          {actionableIntent && isVerified ? (
            <Banner
              tone="info"
              title={t('matchContactReady', { title: actionableIntent.targetTitle })}
            >
              <Inline gap={2} wrap>
                <Button
                  disabled={contactMutation.isPending}
                  loading={contactMutation.isPending}
                  onClick={() =>
                    void handleContact({
                      suggestion_id: actionableIntent.toPostId,
                      batch_number: 1,
                      position: 1,
                      candidate_type: 'neighbor_post',
                      candidate_id: actionableIntent.toPostId,
                      score: 0,
                      reasons: [],
                      distance_miles: null,
                      neighbor_post: {
                        post_id: actionableIntent.toPostId,
                        community_id: '',
                        post_type: 'offer',
                        category: 'other',
                        title: actionableIntent.targetTitle,
                        body: '',
                        language: activeLanguage,
                        location_zip: '',
                        privacy: 'community_only',
                        status: 'active',
                        risk_level: 'low',
                        created_at: actionableIntent.createdAt,
                        updated_at: actionableIntent.createdAt,
                        expires_at: actionableIntent.createdAt,
                        is_owner: false,
                      },
                      official_resource: null,
                    })
                  }
                  variant="primary"
                >
                  {t('matchContinueIntent')}
                </Button>
                <Button
                  onClick={() => {
                    clearMatchContactIntent();
                    setIntent(null);
                  }}
                  variant="ghost"
                >
                  {t('matchClearIntent')}
                </Button>
              </Inline>
            </Banner>
          ) : null}

          {/* Contact-sent confirmation. */}
          {contactResult?.status === 'pending' ? (
            <Banner
              tone="success"
              title={t('matchContactPending')}
              actionLabel={t('matchGoInbox')}
              actionVariant="primary"
              onAction={() => router.push('/inbox')}
            />
          ) : null}

          {/* Errors. */}
          {matchesQuery.isError || refreshMutation.isError || contactMutation.isError ? (
            <Banner
              tone="danger"
              title={
                (matchesQuery.error ??
                  refreshMutation.error ??
                  contactMutation.error) instanceof Error
                  ? ((matchesQuery.error ??
                      refreshMutation.error ??
                      contactMutation.error) as Error).message
                  : t('matchUnavailable')
              }
            />
          ) : null}

          {/* Gating copy when the signed-in user is the wrong actor for this */}
          {/* page (non-owner, or the post isn't an active request).          */}
          {!canShowMatches && post ? (
            <Card>
              <p className="muted">
                {post.is_owner ? t('matchNeedsActiveRequest') : t('matchOwnerOnly')}
              </p>
            </Card>
          ) : null}

          {/* Refresh status row + fresh/stale hints. */}
          {canShowMatches && activeResults ? (
            <Inline gap={3} wrap justify="between" align="center">
              {refreshStatus ? <Tag tone="neutral">{refreshStatus}</Tag> : <span />}
              <IconButton
                aria-label={t('matchRefreshAction')}
                data-testid="match-refresh"
                disabled={!canRefresh}
                onClick={() =>
                  void refreshMutation.mutateAsync().then((results) => {
                    setResultOverride(results);
                  })
                }
                shape="circle"
                size="md"
                tone="community"
                variant="tonal"
              >
                <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
                  <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 0 1 6 6 6 6 0 0 1-6 6 6 6 0 0 1-5.65-8H4.26A8 8 0 1 0 17.65 6.35Z" />
                </svg>
              </IconButton>
            </Inline>
          ) : null}

          {canShowMatches && freshResultsVisible ? (
            <Banner
              data-testid="match-fresh-banner"
              tone="success"
              title={t('matchFreshResults')}
            />
          ) : null}
          {canShowMatches && staleResultsVisible ? (
            <p className="muted" data-testid="match-stale-hint">
              {t('matchStaleResults')}
            </p>
          ) : null}
          {canShowMatches && refreshesExhausted ? (
            <p className="muted" data-testid="match-no-more-refreshes">
              {t('matchNoMoreRefreshes')}
            </p>
          ) : null}

          {/* Loading skeletons. */}
          {canShowMatches && matchesQuery.isLoading ? (
            <div
              role="status"
              aria-busy="true"
              aria-label={t('loadingLabel')}
              data-testid="match-results-loading"
            >
              <Stack gap={3}>
                {[0, 1, 2].map((idx) => (
                  <Card key={idx}>
                    <Stack gap={2}>
                      <Skeleton
                        variant="text"
                        width="55%"
                        label={idx === 0 ? t('matchLoading') : undefined}
                      />
                      <Skeleton variant="text" width="80%" />
                      <Skeleton variant="rect" height={40} />
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </div>
          ) : null}

          {/* Empty state. */}
          {canShowMatches &&
          !matchesQuery.isLoading &&
          (!activeResults || activeResults.items.length === 0) ? (
            <EmptyState
              illustrationName="matches-empty"
              title={t('emptyStateMatchesTitle')}
              subtitle={t('emptyStateMatchesSubtitle')}
            />
          ) : null}

          {/* Match list. */}
          {canShowMatches && activeResults && activeResults.items.length > 0 ? (
            <Stack gap={3}>
              {activeResults.items.map((item) => {
                if (item.candidate_type === 'neighbor_post' && item.neighbor_post) {
                  return (
                    <Card as="article" key={item.suggestion_id}>
                      <Stack gap={3}>
                        <Inline gap={2} wrap>
                          <Tag tone={item.neighbor_post.post_type === 'offer' ? 'verified' : 'community'}>
                            {getPostTypeLabel(activeLanguage, item.neighbor_post.post_type)}
                          </Tag>
                          <Tag tone="accent">
                            {getCategoryLabel(activeLanguage, item.neighbor_post.category)}
                          </Tag>
                          {item.distance_miles !== null ? (
                            <Tag tone="neutral">
                              {t('distanceMiles', {
                                distance: item.distance_miles.toFixed(1),
                              })}
                            </Tag>
                          ) : null}
                        </Inline>
                        <h3 style={{ margin: 0 }}>{item.neighbor_post.title}</h3>
                        {item.neighbor_post.body ? (
                          <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                            {item.neighbor_post.body.length > 140
                              ? `${item.neighbor_post.body.slice(0, 140)}\u2026`
                              : item.neighbor_post.body}
                          </p>
                        ) : null}
                        {item.reasons.length > 0 ? (
                          <Inline gap={2} wrap>
                            {item.reasons.map((reason) => (
                              <Tag tone="neutral" key={reason}>
                                {getMatchReasonLabel(activeLanguage, reason)}
                              </Tag>
                            ))}
                          </Inline>
                        ) : null}
                        <Inline gap={2} wrap>
                          <Button
                            onClick={() => void handleContact(item)}
                            loading={contactMutation.isPending}
                            variant="primary"
                            // Wave 6C — contacting a neighbor match is
                            // the match-result screen's primary CTA and
                            // kicks off a mutation. Tactile cue on tap
                            // bridges the gap before the toast appears.
                            haptic
                          >
                            {t('matchContactAction')}
                          </Button>
                          <Button
                            as="a"
                            href={`/posts/${item.neighbor_post.post_id}`}
                            variant="ghost"
                          >
                            {t('matchOpenPost')}
                          </Button>
                        </Inline>
                      </Stack>
                    </Card>
                  );
                }

                if (item.official_resource) {
                  const resource = item.official_resource;
                  const distanceLabel =
                    resource.distance_miles !== null
                      ? t('distanceMiles', { distance: resource.distance_miles.toFixed(1) })
                      : undefined;
                  // ResourceSummary uses the `type` field (pantry/meal/etc.);
                  // those enums overlap with a subset of ResourceCardCategory
                  // already, so when the value is recognised we pass it
                  // through — otherwise we fall back to `other`.
                  const allowedResourceTypes: readonly ResourceCardCategory[] = [
                    'food',
                    'pantry',
                    'kitchen',
                    'market',
                    'benefits',
                    'health',
                    'other',
                  ];
                  const categoryForAtom: ResourceCardCategory = allowedResourceTypes.includes(
                    resource.type as ResourceCardCategory,
                  )
                    ? (resource.type as ResourceCardCategory)
                    : 'other';
                  return (
                    <Stack key={item.suggestion_id} gap={2}>
                      <Inline gap={2} wrap>
                        <Tag tone="community">{t('matchOfficialFallback')}</Tag>
                      </Inline>
                      <ResourceCard
                        resource={{
                          id: resource.provider_id,
                          name: resource.name,
                          category: categoryForAtom,
                          distanceLabel,
                          address: resource.address ?? undefined,
                          phone: resource.phone ?? null,
                        }}
                        labels={{
                          openLabel: resource.name,
                          bookmarkLabel: t('save'),
                          callLabel: t('call'),
                          directionsLabel: t('directions'),
                        }}
                        onOpen={() => router.push(`/resources/${resource.provider_id}`)}
                        onCall={
                          resource.phone
                            ? (phone) => {
                                if (typeof window !== 'undefined') {
                                  window.location.href = `tel:${phone}`;
                                }
                              }
                            : undefined
                        }
                        onDirections={
                          resource.directions_url
                            ? () => {
                                if (typeof window !== 'undefined') {
                                  window.open(
                                    resource.directions_url!,
                                    '_blank',
                                    'noopener,noreferrer',
                                  );
                                }
                              }
                            : undefined
                        }
                      />
                      {item.reasons.length > 0 ? (
                        <Inline gap={2} wrap>
                          {item.reasons.map((reason) => (
                            <Tag tone="neutral" key={reason}>
                              {getMatchReasonLabel(activeLanguage, reason)}
                            </Tag>
                          ))}
                        </Inline>
                      ) : null}
                    </Stack>
                  );
                }

                return null;
              })}
            </Stack>
          ) : null}
        </Stack>
      </div>
    </>
  );
}
