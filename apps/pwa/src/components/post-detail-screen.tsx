'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { TopBar } from '@/components/shell';
import {
  Banner,
  Button,
  Card,
  Field,
  IconButton,
  Inline,
  Pill,
  Skeleton,
  Stack,
  Tag,
} from '@/components/ui';
import { resolveErrorKey } from '@/lib/error-i18n';
import {
  useAppSelector,
  useClosePost,
  useCreateReport,
  useDeletePost,
  usePost,
  useUpdatePost,
} from '@/lib/hooks';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/datetime';
import {
  getCategoryLabel,
  getPostPrivacyLabel,
  getPostStatusLabel,
  getPostTypeLabel,
} from '@/lib/i18n';
import { selectPreferences, selectSession } from '@/lib/selectors';
import type { PostCategory, PostPrivacy } from '@/lib/types';

/** Canonical post category list — shared with the composer so the edit view
 *  offers identical options. Keep in sync with `PostCategory` in types.ts. */
const POST_CATEGORIES: readonly PostCategory[] = [
  'food',
  'goods',
  'childcare',
  'companionship',
  'translation',
  'transportation',
  'other',
] as const;

/** Canonical post privacy list. */
const POST_PRIVACIES: readonly PostPrivacy[] = [
  'community_only',
  'public',
  'anchor_mediated',
] as const;

type PostDetailScreenProps = {
  postId: string;
};

/**
 * W4A — Single post detail.
 *
 * Layout:
 *   TopBar (back → previous page; falls back to /posts/mine)
 *   ── Hero `<Card>`: type + category tags, title, body, ZIP + expiry chips
 *   ── Owner actions (if is_owner): edit / close / delete IconButton row
 *   ── Non-owner actions: "See matches" on active requests; otherwise a back
 *      affordance is enough (the AppShell tab bar owns inbox / post FAB).
 *
 * Edit mode swaps the hero for a single-focus form so the user stays on one
 * page (Field atom wraps the inputs with proper aria wiring).
 *
 * Preserved business logic:
 *   - `usePost` / `useUpdatePost` / `useClosePost` / `useDeletePost` hooks
 *   - `is_owner` gating for edit/close/delete
 *   - The legacy "see matches" anchor on active owner-owned requests
 */
export function PostDetailScreen({ postId }: PostDetailScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  const postQuery = usePost(session?.access_token, postId, Boolean(session));
  const updateMutation = useUpdatePost(session?.access_token);
  const closeMutation = useClosePost(session?.access_token);
  const deleteMutation = useDeletePost(session?.access_token);
  const reportMutation = useCreateReport(session?.access_token);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [reported, setReported] = useState(false);
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

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitlePostDetail')} \u2014 WeaveNYC`;
  }, [t]);

  if (!session) {
    return (
      <>
        <TopBar
          variant="page"
          eyebrow={t('pageTitlePostDetail')}
          title={t('postDetailTitle')}
          backHref="/"
        />
        <div className="page-content">
          <Card variant="raised">
            <Stack gap={3}>
              <Stack gap={1}>
                <span className="overline">{t('sessionAnonymous')}</span>
                <h2>{t('joinNeedsSession')}</h2>
              </Stack>
              <Inline gap={3} wrap>
                <Button as="a" variant="primary" href="/">
                  {t('backHome')}
                </Button>
              </Inline>
            </Stack>
          </Card>
        </div>
      </>
    );
  }

  const loading = postQuery.isLoading;
  const errored = postQuery.isError;

  return (
    <>
      <TopBar
        variant="page"
        eyebrow={t('pageTitlePostDetail')}
        title={post?.title ?? t('postDetailTitle')}
        backHref="/posts/mine"
      />
      <div className="page-content" data-screen="post-detail">
        <Stack gap={5} as="section">
          {loading ? (
            <div role="status" aria-busy="true" aria-label={t('loadingLabel')}>
              <Card>
                <Stack gap={3}>
                  <Skeleton variant="text" width="60%" label={t('resourceLoading')} />
                  <Skeleton variant="text" width="90%" />
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="rect" height={120} />
                </Stack>
              </Card>
            </div>
          ) : null}

          {errored ? (
            <Banner tone="danger" title={t(resolveErrorKey(postQuery.error))} />
          ) : null}

          {post && !editing ? (
            <>
              {/* Hero: tags + title + body + ZIP/expiry chips */}
              <Card variant="accent" aria-labelledby="post-detail-title">
                <Stack gap={4}>
                  <Inline gap={2} wrap>
                    <Tag tone={post.post_type === 'offer' ? 'verified' : 'community'}>
                      {getPostTypeLabel(preferences.language, post.post_type)}
                    </Tag>
                    <Tag tone="accent">
                      {getCategoryLabel(preferences.language, post.category)}
                    </Tag>
                    <Tag tone="neutral">
                      {getPostStatusLabel(preferences.language, post.status)}
                    </Tag>
                    <Tag tone="neutral">
                      {getPostPrivacyLabel(preferences.language, post.privacy)}
                    </Tag>
                  </Inline>

                  <h2 id="post-detail-title">{post.title}</h2>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{post.body}</p>

                  <Inline gap={2} wrap>
                    <Tag tone="neutral">{t('zipChip', { zip: post.location_zip })}</Tag>
                    <Tag tone="neutral">
                      {new Date(post.expires_at).toLocaleString()}
                    </Tag>
                  </Inline>
                </Stack>
              </Card>

              {/* Actions split into three lanes:
                  1. Owner primary CTA (see matches on active requests)
                  2. Owner meta row (edit / close / delete icon buttons)
                  3. Non-owner contact + report actions
                  ----------------------------------------------------- */}
              <Stack gap={3}>
                {post.is_owner && post.post_type === 'request' && post.status === 'active' ? (
                  <Inline gap={3} wrap>
                    <Button
                      as="a"
                      href={`/posts/${post.post_id}/matches`}
                      variant="primary"
                    >
                      {t('seeActionPlans')}
                    </Button>
                  </Inline>
                ) : null}

                {post.is_owner ? (
                  <Inline gap={2} wrap align="center">
                    {post.actions.can_edit ? (
                      <IconButton
                        aria-label={t('postEditAction')}
                        onClick={() => setEditing(true)}
                        size="md"
                        shape="square"
                        variant="tonal"
                        tone="accent"
                      >
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
                          <path d="M3 21v-4l12-12 4 4L7 21H3Z" />
                          <path d="M16 6l2-2a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-2 2Z" />
                        </svg>
                      </IconButton>
                    ) : null}
                    {post.actions.can_close ? (
                      <IconButton
                        aria-label={t('postCloseAction')}
                        onClick={() => setConfirmingClose(true)}
                        size="md"
                        shape="square"
                        variant="ghost"
                        tone="neutral"
                      >
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
                          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4 11H8v-2h8Z" />
                        </svg>
                      </IconButton>
                    ) : null}
                    {post.actions.can_delete ? (
                      <IconButton
                        aria-label={t('postDeleteAction')}
                        onClick={() => setConfirmingDelete(true)}
                        size="md"
                        shape="square"
                        variant="ghost"
                        tone="danger"
                      >
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
                          <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6Zm3-10h2v8H9Zm4 0h2v8h-2ZM15.5 4l-1-1h-5l-1 1H5v2h14V4Z" />
                        </svg>
                      </IconButton>
                    ) : null}
                  </Inline>
                ) : null}

                {/* Non-owner actions: primary Contact CTA + ghost Report flag.
                    The Contact path routes to the composer pre-loaded with the
                    opposite post_type so the user can publish their own post
                    and, through the matches pipeline, connect back to this
                    one. The Report IconButton posts a `post`-target report via
                    createReport and shows an inline success Banner. */}
                {!post.is_owner ? (
                  <Inline gap={3} wrap align="center">
                    <Button
                      data-testid="post-contact-owner"
                      onClick={() =>
                        router.push(
                          `/posts/new?post_type=${post.post_type === 'request' ? 'offer' : 'request'}`,
                        )
                      }
                      variant="primary"
                    >
                      {t('postContactAction')}
                    </Button>
                    <IconButton
                      data-testid="post-report"
                      aria-label={t('reportPost')}
                      disabled={reportMutation.isPending || reported}
                      onClick={() =>
                        void reportMutation
                          .mutateAsync({
                            targetType: 'post',
                            targetId: post.post_id,
                            reason: 'unsafe_behavior',
                          })
                          .then(() => setReported(true))
                      }
                      size="md"
                      shape="square"
                      variant="ghost"
                      tone="danger"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width={16}
                        height={16}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 22V4" />
                        <path d="M4 15l10-3a4 4 0 0 1 4 1l2 1V6l-2-1a4 4 0 0 0-4-1L4 7" />
                      </svg>
                    </IconButton>
                  </Inline>
                ) : null}

                {/* Close confirmation — same inline Banner pattern as delete,
                    so the owner's risky state changes are never one-tap. */}
                {confirmingClose ? (
                  <Banner
                    data-testid="post-close-confirm"
                    tone="warning"
                    title={t('postCloseConfirmTitle')}
                  >
                    <Inline gap={2} wrap>
                      <Button
                        variant="primary"
                        onClick={() =>
                          void closeMutation
                            .mutateAsync(postId)
                            .then(() => setConfirmingClose(false))
                        }
                        loading={closeMutation.isPending}
                      >
                        {t('postCloseConfirmCta')}
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmingClose(false)}>
                        {t('buttonCancel')}
                      </Button>
                    </Inline>
                  </Banner>
                ) : null}

                {/* Delete confirmation lives inline so the page never jumps. */}
                {confirmingDelete ? (
                  <Banner tone="danger" title={t('postDeleteAction')}>
                    <Inline gap={2} wrap>
                      <Button
                        variant="danger"
                        onClick={() =>
                          void deleteMutation
                            .mutateAsync(postId)
                            .then(() => setConfirmingDelete(false))
                        }
                        loading={deleteMutation.isPending}
                      >
                        {t('postDeleteAction')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setConfirmingDelete(false)}
                      >
                        {t('buttonCancel')}
                      </Button>
                    </Inline>
                  </Banner>
                ) : null}

                {reported ? (
                  <Banner tone="success" title={t('postReported')} />
                ) : null}

                {updateMutation.error ||
                closeMutation.error ||
                deleteMutation.error ||
                reportMutation.error ? (
                  <Banner
                    tone="danger"
                    title={
                      (updateMutation.error ??
                        closeMutation.error ??
                        deleteMutation.error ??
                        reportMutation.error) instanceof Error
                        ? ((updateMutation.error ??
                            closeMutation.error ??
                            deleteMutation.error ??
                            reportMutation.error) as Error).message
                        : t('resourceLoadError')
                    }
                  />
                ) : null}
              </Stack>
            </>
          ) : null}

          {post && editing && formState ? (
            <Card variant="raised">
              <Stack gap={4}>
                <Stack gap={1}>
                  <span className="overline">{t('postEditAction')}</span>
                  <h2>{post.title}</h2>
                </Stack>

                <Field label={t('composeTitleLabel')}>
                  <input
                    onChange={(event) =>
                      setFormState({ ...formState, title: event.target.value })
                    }
                    value={formState.title}
                  />
                </Field>

                <Field label={t('composeBodyLabel')}>
                  <textarea
                    onChange={(event) =>
                      setFormState({ ...formState, body: event.target.value })
                    }
                    rows={6}
                    value={formState.body}
                  />
                </Field>

                {/* Category — same Pill row the composer uses so edit mode
                    can reach every `PostCategory`. Without this the form
                    held a stale category and silently replayed it on save. */}
                <fieldset
                  style={{ border: 0, padding: 0, margin: 0 }}
                  aria-labelledby="post-detail-category-legend"
                >
                  <legend
                    id="post-detail-category-legend"
                    className="field__label"
                    style={{ padding: 0, marginBottom: 'var(--space-2)' }}
                  >
                    {t('filtersType')}
                  </legend>
                  <Inline gap={2} wrap>
                    {POST_CATEGORIES.map((category) => (
                      <Pill
                        key={category}
                        active={formState.category === category}
                        data-testid={`post-edit-category-${category}`}
                        onClick={() => setFormState({ ...formState, category })}
                      >
                        {getCategoryLabel(preferences.language, category)}
                      </Pill>
                    ))}
                  </Inline>
                </fieldset>

                {/* Privacy — native select wrapped by Field. Kept as a select
                    (not a radio group) to match the composer's affordance and
                    keep scan-time compact for only 3 options. */}
                <Field label={t('composePrivacyLabel')} className="field--select">
                  <select
                    data-testid="post-edit-privacy"
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        privacy: event.target.value as PostPrivacy,
                      })
                    }
                    value={formState.privacy}
                  >
                    {POST_PRIVACIES.map((privacy) => (
                      <option key={privacy} value={privacy}>
                        {getPostPrivacyLabel(preferences.language, privacy)}
                      </option>
                    ))}
                  </select>
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

                <Inline gap={3} wrap>
                  <Button
                    data-testid="post-edit-save"
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
                    loading={updateMutation.isPending}
                    variant="primary"
                  >
                    {t('save')}
                  </Button>
                  <Button onClick={() => setEditing(false)} variant="ghost">
                    {t('buttonCancel')}
                  </Button>
                </Inline>
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </div>
    </>
  );
}
