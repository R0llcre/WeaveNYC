'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { useAppSelector, useClosePost, useDeletePost, usePost, useUpdatePost } from '@/lib/hooks';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/datetime';
import { getCategoryLabel, getPostPrivacyLabel, getPostStatusLabel, getPostTypeLabel } from '@/lib/i18n';

type PostDetailScreenProps = {
  postId: string;
};

export function PostDetailScreen({ postId }: PostDetailScreenProps) {
  const t = useTranslations();
  const preferences = useAppSelector((state) => state.preferences);
  const session = useAppSelector((state) => state.auth.session);
  const postQuery = usePost(session?.access_token, postId, Boolean(session));
  const updateMutation = useUpdatePost(session?.access_token);
  const closeMutation = useClosePost(session?.access_token);
  const deleteMutation = useDeletePost(session?.access_token);
  const [editing, setEditing] = useState(false);
  const post = postQuery.data;

  const editState = useMemo(
    () =>
      post
        ? {
            title: post.title,
            body: post.body,
            category: post.category,
            privacy: post.privacy,
            expiresAt: post.expires_at,
          }
        : null,
    [post],
  );
  const [formState, setFormState] = useState(editState);

  useEffect(() => {
    setFormState(editState);
  }, [editState]);

  if (!session) {
    return (
      <main className="shell">
        <div className="shell__inner">
          <section className="card card--verify">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <Link className="button button--primary" href="/">
                {t('backHome')}
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="shell__inner">
        <section className="hero hero--detail">
          <div className="hero__topbar">
            <span className="hero__eyebrow">{t('postDetailTitle')}</span>
            <div className="actions actions--tight">
              <ContactInboxLink />
              <Link className="hero__link" href="/community">
                {t('backHome')}
              </Link>
            </div>
          </div>
          <h1>{post?.title ?? t('resourceLoading')}</h1>
          {post ? (
            <div className="hero__meta">
              <span className="meta-chip">{getPostTypeLabel(preferences.language, post.post_type)}</span>
              <span className="meta-chip">{getCategoryLabel(preferences.language, post.category)}</span>
              <span className="meta-chip">{getPostPrivacyLabel(preferences.language, post.privacy)}</span>
              <span className="meta-chip">{getPostStatusLabel(preferences.language, post.status)}</span>
            </div>
          ) : null}
        </section>

        <section className="card detail-card">
          {postQuery.isLoading ? <p className="status-copy">{t('resourceLoading')}</p> : null}
          {postQuery.isError ? (
            <p className="status-copy status-copy--error">
              {postQuery.error instanceof Error ? postQuery.error.message : t('resourceLoadError')}
            </p>
          ) : null}

          {post ? (
            <div className="verify-grid">
              {editing && formState ? (
                <>
                  <label className="field">
                    <span>{t('composeTitleLabel')}</span>
                    <input onChange={(event) => setFormState({ ...formState, title: event.target.value })} value={formState.title} />
                  </label>
                  <label className="field">
                    <span>{t('composeBodyLabel')}</span>
                    <textarea onChange={(event) => setFormState({ ...formState, body: event.target.value })} rows={6} value={formState.body} />
                  </label>
                  <label className="field">
                    <span>{t('composeExpiresLabel')}</span>
                    <input
                      onChange={(event) =>
                        setFormState({
                          ...formState,
                          expiresAt: fromDateTimeLocalValue(event.target.value),
                        })
                      }
                      type="datetime-local"
                      value={toDateTimeLocalValue(formState.expiresAt)}
                    />
                  </label>
                  <div className="actions">
                    <button
                      className="button button--primary"
                      onClick={() =>
                        void updateMutation.mutateAsync({
                          postId,
                          patch: {
                            title: formState.title,
                            body: formState.body,
                            category: formState.category,
                            privacy: formState.privacy,
                            expiresAt: formState.expiresAt,
                          },
                        }).then(() => setEditing(false))
                      }
                      type="button"
                    >
                      {t('save')}
                    </button>
                    <button className="button button--secondary" onClick={() => setEditing(false)} type="button">
                      {t('clearJoinPreview')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>{post.body}</p>
                  <p className="resource-card__subtle">
                    {post.location_zip} · {new Date(post.expires_at).toLocaleString()}
                  </p>
                  <div className="actions">
                    {post.is_owner && post.post_type === 'request' && post.status === 'active' ? (
                      <Link className="button button--primary" href={`/posts/${post.post_id}/matches`}>
                        {t('seeActionPlans')}
                      </Link>
                    ) : null}
                    {post.actions.can_edit ? (
                      <button className="button button--secondary" onClick={() => setEditing(true)} type="button">
                        {t('postEditAction')}
                      </button>
                    ) : null}
                    {post.actions.can_close ? (
                      <button className="button button--secondary" onClick={() => void closeMutation.mutateAsync(postId)} type="button">
                        {t('postCloseAction')}
                      </button>
                    ) : null}
                    {post.actions.can_delete ? (
                      <button className="button button--secondary" onClick={() => void deleteMutation.mutateAsync(postId)} type="button">
                        {t('postDeleteAction')}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
