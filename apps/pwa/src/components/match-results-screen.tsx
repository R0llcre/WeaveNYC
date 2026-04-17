'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { Banner, Button, Card, PageHeader } from '@/components/ui';
import { createAnonymousSession } from '@/lib/api';
import { clearMatchContactIntent, loadMatchContactIntent, saveMatchContactIntent } from '@/lib/match-intent';
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
  getChromeCopy,
  getMatchReasonLabel,
  getPostTypeLabel,
  getSessionLabel,
} from '@/lib/i18n';
import {
  selectIsVerified,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import { setSession } from '@/lib/slices/auth-slice';
import type { MatchContactResult, MatchSuggestion } from '@/lib/types';

type MatchResultsScreenProps = {
  postId: string;
};

const FRESH_RESULTS_WINDOW_MS = 60_000;
const INTENT_CONSUMED_STORAGE_PREFIX = 'weavenyc.intent_consumed_';

function markIntentConsumed(intentKey: string): boolean {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    // When sessionStorage is unavailable, fall back to letting the caller
    // proceed — the in-memory guards still prevent duplicate submits in
    // the current tab.
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

export function MatchResultsScreen({ postId }: MatchResultsScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);
  const preferences = useAppSelector(selectPreferences);
  const [isCreatingSession, setCreatingSession] = useState(false);
  const [intent, setIntent] = useState(() => loadMatchContactIntent());
  const [resultOverride, setResultOverride] = useState<ReturnType<typeof useMatchSuggestions>['data'] | null>(null);
  const [contactResult, setContactResult] = useState<MatchContactResult | null>(null);
  const [submittedIntentKey, setSubmittedIntentKey] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeLanguage = preferences.language;
  const sessionLabel = session ? getSessionLabel(activeLanguage, session.user.level) : getChromeCopy(activeLanguage).sessionAnonymous;
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

    // Bug #5 fix: guard by sessionStorage so the intent is consumed at most
    // once per key, even if the user navigates away and back.
    if (!markIntentConsumed(intentKey)) {
      // Already consumed in a previous mount — clear stale local state so
      // the banner doesn't re-arm.
      clearMatchContactIntent();
      setIntent(null);
      setSubmittedIntentKey(intentKey);
      return;
    }

    // Bug #5 fix: clear the intent synchronously BEFORE firing the mutation
    // so any re-render triggered during the async request cannot re-submit.
    setSubmittedIntentKey(intentKey);
    const submittedFromPostId = intent.fromPostId;
    const submittedToPostId = intent.toPostId;
    clearMatchContactIntent();
    setIntent(null);

    void contactMutation
      .mutateAsync({
        fromPostId: submittedFromPostId,
        toPostId: submittedToPostId,
      })
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
  const actionableIntent = intent?.kind === 'match_contact' && intent.fromPostId === postId ? intent : null;

  // Bug #6: when refresh data arrives (initial or manual), start the freshness
  // window. After 60s we mark the view stale so the refresh button copy hints
  // that new matches may be available.
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

  // Reset freshness indicator if the user navigates away from this route.
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
      router.push(`/verify?return_to=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!isVerified) {
      saveMatchContactIntent(nextIntent);
      setIntent(nextIntent);
      router.push(`/verify?return_to=${encodeURIComponent(pathname)}`);
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

  const headerSubtitle = useMemo(() => {
    if (activeResults) {
      return t('matchRefreshStatus', {
        used: activeResults.refreshes_used,
        max: activeResults.max_refreshes,
      });
    }

    return sessionLabel;
  }, [activeResults, sessionLabel, t]);

  return (
    <main className="shell" id="main-content" tabIndex={-1}>
      <div className="shell__inner">
        <PageHeader
          eyebrow={t('matchTitle')}
          title={t('matchTitle')}
          subtitle={t('matchCopy')}
          actions={
            <>
              <ContactInboxLink />
              <Link className="hero__link" href={`/posts/${postId}`}>
                {t('backHome')}
              </Link>
            </>
          }
        />
        <div className="hero__meta">
          <span className="meta-chip">{headerSubtitle}</span>
          {post ? <span className="meta-chip">{post.title}</span> : null}
        </div>

        {!session ? (
          <Card variant="raised">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <Button
                disabled={isCreatingSession}
                onClick={() => void handleCreateSession()}
                variant="primary"
              >
                {isCreatingSession ? t('creatingSession') : t('createSession')}
              </Button>
            </div>
          </Card>
        ) : null}

        {actionableIntent && isVerified ? (
          <Banner tone="info" title={t('matchContactReady', { title: actionableIntent.targetTitle })}>
            <div className="actions">
              <Button
                disabled={contactMutation.isPending}
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
                variant="secondary"
              >
                {t('matchClearIntent')}
              </Button>
            </div>
          </Banner>
        ) : null}

        {contactResult?.status === 'pending' ? (
          <Banner tone="success" title={t('matchContactPending')}>
            <div className="actions">
              <Button as="a" variant="primary" href="/inbox">
                {t('matchGoInbox')}
              </Button>
            </div>
          </Banner>
        ) : null}

        <Card className="card--results">
          {!canShowMatches && post ? (
            <div className="result-empty">
              <p>{post.is_owner ? t('matchNeedsActiveRequest') : t('matchOwnerOnly')}</p>
            </div>
          ) : null}

          {matchesQuery.isLoading ? <p className="status-copy">{t('matchLoading')}</p> : null}
          {(matchesQuery.isError || refreshMutation.isError || contactMutation.isError) ? (
            <p className="status-copy status-copy--error">
              {(
                matchesQuery.error ??
                refreshMutation.error ??
                contactMutation.error
              ) instanceof Error
                ? (
                    matchesQuery.error ??
                    refreshMutation.error ??
                    contactMutation.error
                  )?.message
                : t('matchUnavailable')}
            </p>
          ) : null}

          {canShowMatches ? (
            <>
              <div className="section-head">
                <div>
                  <h2>{t('matchTitle')}</h2>
                  <p className="card__subtitle">{headerSubtitle}</p>
                </div>
                <div className="actions actions--tight">
                  <Button
                    data-testid="match-refresh"
                    disabled={!canRefresh}
                    onClick={() =>
                      void refreshMutation.mutateAsync().then((results) => {
                        setResultOverride(results);
                      })
                    }
                    variant="secondary"
                  >
                    {t('matchRefreshAction')}
                  </Button>
                </div>
              </div>

              {/* Bug #6 banners: fresh vs stale vs exhausted. */}
              {freshResultsVisible ? (
                <Banner
                  data-testid="match-fresh-banner"
                  tone="success"
                  title={t('matchFreshResults')}
                />
              ) : null}
              {staleResultsVisible ? (
                <p className="status-copy status-copy--muted" data-testid="match-stale-hint">
                  {t('matchStaleResults')}
                </p>
              ) : null}
              {refreshesExhausted ? (
                <p className="status-copy status-copy--muted" data-testid="match-no-more-refreshes">
                  {t('matchNoMoreRefreshes')}
                </p>
              ) : null}

              {!activeResults || activeResults.items.length === 0 ? (
                <div className="result-empty">{t('matchNoResults')}</div>
              ) : (
                <div className="resource-grid">
                  {activeResults.items.map((item) =>
                    item.candidate_type === 'neighbor_post' && item.neighbor_post ? (
                      <article className="post-card" key={item.suggestion_id}>
                        <div className="post-card__meta">
                          <span className="meta-chip">{getPostTypeLabel(activeLanguage, item.neighbor_post.post_type)}</span>
                          <span className="meta-chip">{getCategoryLabel(activeLanguage, item.neighbor_post.category)}</span>
                          {item.distance_miles !== null ? (
                            <span className="meta-chip">
                              {t('distanceMiles', { distance: item.distance_miles.toFixed(1) })}
                            </span>
                          ) : null}
                        </div>
                        <h3>{item.neighbor_post.title}</h3>
                        <p>{item.neighbor_post.body}</p>
                        <div className="match-reasons">
                          {item.reasons.map((reason) => (
                            <span className="meta-chip" key={reason}>
                              {getMatchReasonLabel(activeLanguage, reason)}
                            </span>
                          ))}
                        </div>
                        <div className="actions">
                          <Button
                            onClick={() => void handleContact(item)}
                            variant="primary"
                          >
                            {t('matchContactAction')}
                          </Button>
                          <Button as="a" variant="secondary" href={`/posts/${item.neighbor_post.post_id}`}>
                            {t('matchOpenPost')}
                          </Button>
                        </div>
                      </article>
                    ) : item.official_resource ? (
                      <article className="resource-card" key={item.suggestion_id}>
                        <div className="resource-card__meta">
                          <span className="meta-chip meta-chip--accent">{t('matchOfficialFallback')}</span>
                          {item.official_resource.distance_miles !== null ? (
                            <span className="meta-chip">
                              {t('distanceMiles', { distance: item.official_resource.distance_miles.toFixed(1) })}
                            </span>
                          ) : null}
                        </div>
                        <h3>{item.official_resource.name}</h3>
                        <p>{item.official_resource.address}</p>
                        <div className="match-reasons">
                          {item.reasons.map((reason) => (
                            <span className="meta-chip" key={reason}>
                              {getMatchReasonLabel(activeLanguage, reason)}
                            </span>
                          ))}
                        </div>
                        <div className="actions">
                          <Button
                            as="a"
                            variant="secondary"
                            href={`/resources/${item.official_resource.provider_id}`}
                          >
                            {t('detailCta')}
                          </Button>
                          {item.official_resource.phone ? (
                            <Button as="a" variant="secondary" href={`tel:${item.official_resource.phone}`}>
                              {t('call')}
                            </Button>
                          ) : null}
                          <Button
                            as="a"
                            variant="secondary"
                            href={item.official_resource.directions_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {t('directions')}
                          </Button>
                        </div>
                      </article>
                    ) : null,
                  )}
                </div>
              )}
            </>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
