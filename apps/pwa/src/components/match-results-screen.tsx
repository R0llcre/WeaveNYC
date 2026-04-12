'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
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
import { setSession } from '@/lib/slices/auth-slice';
import type { MatchContactResult, MatchSuggestion } from '@/lib/types';

type MatchResultsScreenProps = {
  postId: string;
};

export function MatchResultsScreen({ postId }: MatchResultsScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.auth.session);
  const preferences = useAppSelector((state) => state.preferences);
  const [creatingSession, setCreatingSession] = useState(false);
  const [intent, setIntent] = useState(() => loadMatchContactIntent());
  const [resultOverride, setResultOverride] = useState<ReturnType<typeof useMatchSuggestions>['data'] | null>(null);
  const [contactResult, setContactResult] = useState<MatchContactResult | null>(null);
  const [submittedIntentKey, setSubmittedIntentKey] = useState<string | null>(null);

  const activeLanguage = preferences.language;
  const sessionLabel = session ? getSessionLabel(activeLanguage, session.user.level) : getChromeCopy(activeLanguage).sessionAnonymous;
  const isVerified = session?.user.level === 'verified' || session?.user.level === 'anchor';

  const postQuery = usePost(session?.access_token, postId, Boolean(session?.access_token));
  const matchesQuery = useMatchSuggestions(session?.access_token, postId, Boolean(session?.access_token));
  const refreshMutation = useRefreshMatchSuggestions(session?.access_token, postId);
  const contactMutation = useCreateMatchContact(session?.access_token);

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

    setSubmittedIntentKey(intentKey);
    void contactMutation
      .mutateAsync({
        fromPostId: intent.fromPostId,
        toPostId: intent.toPostId,
      })
      .then((result) => {
        setContactResult(result);
        clearMatchContactIntent();
        setIntent(null);

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
  const canRefresh = activeResults
    ? activeResults.refreshes_used < activeResults.max_refreshes && !refreshMutation.isPending
    : false;

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
    <main className="shell">
      <div className="shell__inner">
        <section className="hero hero--detail">
          <div className="hero__topbar">
            <span className="hero__eyebrow">{t('matchTitle')}</span>
            <div className="actions actions--tight">
              <ContactInboxLink />
              <Link className="hero__link" href={`/posts/${postId}`}>
                {t('backHome')}
              </Link>
            </div>
          </div>
          <h1>{t('matchTitle')}</h1>
          <p>{t('matchCopy')}</p>
          <div className="hero__meta">
            <span className="meta-chip">{headerSubtitle}</span>
            {post ? <span className="meta-chip">{post.title}</span> : null}
          </div>
        </section>

        {!session ? (
          <section className="card card--verify">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <button
                className="button button--primary"
                disabled={creatingSession}
                onClick={() => void handleCreateSession()}
                type="button"
              >
                {creatingSession ? t('creatingSession') : t('createSession')}
              </button>
            </div>
          </section>
        ) : null}

        {actionableIntent && isVerified ? (
          <section className="card card--verify">
            <div className="callout">
              <p>{t('matchContactReady', { title: actionableIntent.targetTitle })}</p>
              <div className="actions">
                <button
                  className="button button--primary"
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
                  type="button"
                >
                  {t('matchContinueIntent')}
                </button>
                <button
                  className="button button--secondary"
                  onClick={() => {
                    clearMatchContactIntent();
                    setIntent(null);
                  }}
                  type="button"
                >
                  {t('matchClearIntent')}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {contactResult?.status === 'pending' ? (
          <section className="card card--verify">
            <div className="callout">
              <p>{t('matchContactPending')}</p>
              <div className="actions">
                <Link className="button button--primary" href="/inbox">
                  {t('matchGoInbox')}
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <section className="card card--results">
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
                  <button
                    className="button button--secondary"
                    disabled={!canRefresh}
                    onClick={() =>
                      void refreshMutation.mutateAsync().then((results) => {
                        setResultOverride(results);
                      })
                    }
                    type="button"
                  >
                    {t('matchRefreshAction')}
                  </button>
                </div>
              </div>

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
                          <button
                            className="button button--primary"
                            onClick={() => void handleContact(item)}
                            type="button"
                          >
                            {t('matchContactAction')}
                          </button>
                          <Link className="button button--secondary" href={`/posts/${item.neighbor_post.post_id}`}>
                            {t('matchOpenPost')}
                          </Link>
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
                          <Link
                            className="button button--secondary"
                            href={`/resources/${item.official_resource.provider_id}`}
                          >
                            {t('detailCta')}
                          </Link>
                          {item.official_resource.phone ? (
                            <a className="button button--secondary" href={`tel:${item.official_resource.phone}`}>
                              {t('call')}
                            </a>
                          ) : null}
                          <a
                            className="button button--secondary"
                            href={item.official_resource.directions_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {t('directions')}
                          </a>
                        </div>
                      </article>
                    ) : null,
                  )}
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
