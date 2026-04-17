'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { Button, Card, Field, PageHeader } from '@/components/ui';
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
          <Card variant="raised">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <Link className="button button--primary" href="/">
                {t('backHome')}
              </Link>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="shell__inner">
        <PageHeader
          eyebrow={t('postDetailTitle')}
          title={post?.title ?? t('resourceLoading')}
          actions={
            <>
              <ContactInboxLink />
              <Link className="hero__link" href="/community">
                {t('backHome')}
              </Link>
            </>
          }
        />
        {post ? (
          <div className="hero__meta">
            <span className="meta-chip">{getPostTypeLabel(preferences.language, post.post_type)}</span>
            <span className="meta-chip">{getCategoryLabel(preferences.language, post.category)}</span>
            <span className="meta-chip">{getPostPrivacyLabel(preferences.language, post.privacy)}</span>
            <span className="meta-chip">{getPostStatusLabel(preferences.language, post.status)}</span>
          </div>
        ) : null}

        <Card className="detail-card">
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
                  <Field label={t('composeTitleLabel')}>
                    <input
                      onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                      value={formState.title}
                    />
                  </Field>
                  <Field label={t('composeBodyLabel')}>
                    <textarea
                      onChange={(event) => setFormState({ ...formState, body: event.target.value })}
                      rows={6}
                      value={formState.body}
                    />
                  </Field>
                  <Field label={t('composeExpiresLabel')}>
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
                  </Field>
                  <div className="actions">
                    <Button
                      onClick={() =>
                        void updateMutation
                          .mutateAsync({
                            postId,
                            patch: {
                              title: formState.title,
                              body: formState.body,
                              category: formState.category,
                              privacy: formState.privacy,
                              expiresAt: formState.expiresAt,
                            },
                          })
                          .then(() => setEditing(false))
                      }
                      variant="primary"
                    >
                      {t('save')}
                    </Button>
                    <Button onClick={() => setEditing(false)} variant="secondary">
                      {t('clearJoinPreview')}
                    </Button>
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
                      <Button onClick={() => setEditing(true)} variant="secondary">
                        {t('postEditAction')}
                      </Button>
                    ) : null}
                    {post.actions.can_close ? (
                      <Button
                        onClick={() => void closeMutation.mutateAsync(postId)}
                        variant="secondary"
                      >
                        {t('postCloseAction')}
                      </Button>
                    ) : null}
                    {post.actions.can_delete ? (
                      <details className="danger-zone">
                        <summary>{t('postDeleteAction')}</summary>
                        <div className="actions">
                          <Button
                            onClick={() => void deleteMutation.mutateAsync(postId)}
                            variant="danger"
                          >
                            {t('postDeleteAction')}
                          </Button>
                        </div>
                      </details>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
