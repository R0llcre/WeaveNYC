'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { TopBar } from '@/components/shell';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  Icon,
  IconButton,
  Inline,
  Pill,
  Stack,
  Tag,
  Toast,
} from '@/components/ui';
import { createAnonymousSession } from '@/lib/api';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/datetime';
import {
  useAppDispatch,
  useAppSelector,
  useCreatePost,
  useSpeechTranscribe,
} from '@/lib/hooks';
import { getCategoryLabel, getPostPrivacyLabel } from '@/lib/i18n';
import {
  selectCommunity,
  selectPostDraft,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import { listenOnceWithBrowserSpeech, supportsBrowserSpeechRecognition } from '@/lib/speech';
import { setSession } from '@/lib/slices/auth-slice';
import { mergePostDraft, resetPostDraft, setDraftStep } from '@/lib/slices/post-draft-slice';
import type { PostCategory, PostDraftState } from '@/lib/types';

/**
 * W4A — Post Composer.
 *
 * Three-stage flow:
 *
 *   1. Mode — "I need help" (request) vs "I can help" (offer) as two big
 *      tappable `<Card>` tiles. Active card carries an accent border + check
 *      badge. E2E testids `select-request` / `select-offer` are preserved on
 *      the cards' inner buttons so Playwright keeps selecting them by testid.
 *
 *   2. Compose — single-focus form. Category is a `<Pill>` row (not a select)
 *      so all 7 options are visible at once. Title, Details (with microphone
 *      `<IconButton>` + hidden fallback file picker — the `browser-speech`
 *      testid lives on the IconButton). ZIP inherits from preferences. Expiry
 *      and privacy stay as native controls wrapped by `<Field>` for a11y.
 *
 *   3. Preview — renders the draft as a read-only post card (matches how
 *      posts appear elsewhere) and exposes the `publish-post` CTA + a
 *      "Back to edit" escape hatch.
 *
 * Redux + TanStack Query wiring is identical to the M2 implementation — all
 * the business logic (`createAnonymousSession`, `useCreatePost`, speech
 * mutations, draft bookkeeping) is preserved verbatim. Only the presentation
 * atoms + layout change.
 */

const CATEGORIES: readonly PostCategory[] = [
  'food',
  'goods',
  'childcare',
  'companionship',
  'translation',
  'transportation',
  'other',
] as const;

const PRIVACY_OPTIONS = ['community_only', 'public', 'anchor_mediated'] as const;

type ValidationMessages = {
  composerValidationEmptyTitle: string;
  composerValidationLongTitle: string;
  composerValidationEmptyBody: string;
  composerValidationLongBody: string;
  composerValidationNoCategory: string;
  composerValidationNoZip: string;
  composerValidationExpired: string;
};

function validateDraft(draft: PostDraftState, messages: ValidationMessages): string[] {
  const issues: string[] = [];

  const title = draft.title?.trim() ?? '';
  if (!title) {
    issues.push(messages.composerValidationEmptyTitle);
  } else if (title.length > 140) {
    issues.push(messages.composerValidationLongTitle);
  }

  const body = draft.body?.trim() ?? '';
  if (!body) {
    issues.push(messages.composerValidationEmptyBody);
  } else if (body.length > 1000) {
    issues.push(messages.composerValidationLongBody);
  }

  if (!draft.category || !CATEGORIES.includes(draft.category)) {
    issues.push(messages.composerValidationNoCategory);
  }

  if (!/^\d{5}$/.test(draft.locationZip ?? '')) {
    issues.push(messages.composerValidationNoZip);
  }

  const expiresAt = draft.expiresAt ? Date.parse(draft.expiresAt) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    issues.push(messages.composerValidationExpired);
  }

  return issues;
}

export function PostComposerScreen() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);
  const preferences = useAppSelector(selectPreferences);
  const communityState = useAppSelector(selectCommunity);
  const draft = useAppSelector(selectPostDraft);
  const [isCreatingSession, setCreatingSession] = useState(false);
  const [browserSpeechError, setBrowserSpeechError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  // Success toast for post publish — shown briefly before router.push lands.
  // Using `toastSent` ("Sent") as the closest existing generic success key
  // (audit note: do not invent a new key; all toast* keys are in i18n.ts).
  const [publishSuccessToast, setPublishSuccessToast] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const createPostMutation = useCreatePost(session?.access_token);
  const speechMutation = useSpeechTranscribe(session?.access_token);

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitlePostNew')} \u2014 WeaveNYC`;
  }, [t]);

  const currentCommunity = useMemo(
    () =>
      communityState.joinedCommunities.find(
        (item) => item.community.community_id === communityState.currentCommunityId,
      )?.community ?? null,
    [communityState.currentCommunityId, communityState.joinedCommunities],
  );
  const queryPostType = searchParams.get('post_type');
  const requiresVerified = draft.postType === 'offer';

  useEffect(() => {
    if (queryPostType === 'request' || queryPostType === 'offer') {
      dispatch(
        mergePostDraft({
          postType: queryPostType,
          step: draft.step === 'type' ? 'compose' : draft.step,
        }),
      );
    }
  }, [dispatch, draft.step, queryPostType]);

  useEffect(() => {
    dispatch(
      mergePostDraft({
        language: draft.language || preferences.language,
        locationZip: draft.locationZip || preferences.zipCode,
      }),
    );
  }, [dispatch, draft.language, draft.locationZip, preferences.language, preferences.zipCode]);

  // Clear stale validation issues whenever the draft or step changes.
  useEffect(() => {
    setValidationIssues([]);
  }, [draft.step, draft.title, draft.body, draft.category, draft.locationZip, draft.expiresAt]);

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      dispatch(setSession(await createAnonymousSession()));
    } finally {
      setCreatingSession(false);
    }
  };

  const handleBrowserSpeech = async () => {
    try {
      setBrowserSpeechError(null);
      // Bug #3 fix: use Redux state directly (no stale ref) so the transcript
      // always appends to the latest body.
      const current = draft.body;
      const transcript = await listenOnceWithBrowserSpeech(preferences.language);
      dispatch(
        mergePostDraft({
          body: [current, transcript].filter(Boolean).join('\n').trim(),
        }),
      );
    } catch (error) {
      setBrowserSpeechError(error instanceof Error ? error.message : t('speechBrowserError'));
    }
  };

  const handleFallbackAudio = async (file: File | undefined) => {
    if (!file || !session?.access_token) {
      return;
    }
    const result = await speechMutation.mutateAsync({
      audio: file,
      language: preferences.language,
      transcriptHint: '',
      fileName: file.name,
    });
    const current = draft.body;
    dispatch(
      mergePostDraft({
        body: [current, result.transcript].filter(Boolean).join('\n').trim(),
      }),
    );
  };

  const validationMessages: ValidationMessages = useMemo(
    () => ({
      composerValidationEmptyTitle: t('composerValidationEmptyTitle'),
      composerValidationLongTitle: t('composerValidationLongTitle'),
      composerValidationEmptyBody: t('composerValidationEmptyBody'),
      composerValidationLongBody: t('composerValidationLongBody'),
      composerValidationNoCategory: t('composerValidationNoCategory'),
      composerValidationNoZip: t('composerValidationNoZip'),
      composerValidationExpired: t('composerValidationExpired'),
    }),
    [t],
  );

  const currentIssues = useMemo(
    () => validateDraft(draft, validationMessages),
    [draft, validationMessages],
  );
  const isDraftValid = currentIssues.length === 0;

  const handlePublish = async () => {
    if (!session?.access_token || !currentCommunity || !draft.postType) {
      return;
    }
    const issues = validateDraft(draft, validationMessages);
    if (issues.length > 0) {
      setValidationIssues(issues);
      dispatch(setDraftStep('compose'));
      return;
    }
    setValidationIssues([]);

    const created = await createPostMutation.mutateAsync({
      communityId: currentCommunity.community_id,
      postType: draft.postType,
      category: draft.category,
      title: draft.title,
      body: draft.body,
      language: draft.language,
      locationZip: draft.locationZip,
      privacy: draft.privacy,
      expiresAt: draft.expiresAt,
      contactPref: {
        in_app_chat: draft.contactPref.inAppChat,
        call: draft.contactPref.call,
        text: draft.contactPref.text,
        notes: draft.contactPref.notes || undefined,
      },
    });

    dispatch(resetPostDraft());
    // Fire a success toast so the user sees the confirmation even if the
    // route transition is instant. `toastSent` ("Sent" / "Enviado" / "已发送")
    // is the closest existing generic success key — no new key is invented.
    setPublishSuccessToast(t('toastSent'));
    // Both request and offer posts land on the post detail page so the
    // author sees their post went live. The UX audit suggested requests
    // should jump to a matches feed immediately, but the existing
    // `/posts/matches/` route is a global matches inbox, not post-scoped,
    // so the detail page is a cleaner home for the confirmation moment.
    // Revisit if/when a `/posts/{id}/matches/` route ships.
    router.push(`/posts/${created.post_id}/`);
  };

  const stepOrder: Array<'type' | 'compose' | 'preview'> = ['type', 'compose', 'preview'];
  const currentStepIndex = stepOrder.indexOf(draft.step);

  const draftCategoryLabel = draft.category
    ? getCategoryLabel(preferences.language, draft.category)
    : '';
  const draftPostTypeLabel = draft.postType === 'offer' ? t('offerHelpCta') : t('requestHelpCta');

  return (
    <>
      <TopBar
        variant="page"
        eyebrow={t('pageTitlePostNew')}
        title={t('composeTitle')}
        backHref="/community/"
      />
      <div className="page-content" data-screen="post-composer">
        <Stack gap={5} as="section">
          {/* ---------------------------------------------------------------- */}
          {/* Prerequisites: need a session, need a community, offers need     */}
          {/* verification. Each surface keeps the original testid / CTA href. */}
          {/* ---------------------------------------------------------------- */}
          {!session ? (
            <Card variant="raised">
              <Stack gap={3}>
                <Stack gap={1}>
                  <span className="overline">{t('sessionAnonymous')}</span>
                  <h2>{t('joinNeedsSession')}</h2>
                </Stack>
                <Inline gap={3} wrap>
                  <Button
                    data-testid="create-session"
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

          {session && !currentCommunity ? (
            <Card variant="raised">
              <Stack gap={3}>
                <Stack gap={1}>
                  <span className="overline">{t('currentCommunityLabel')}</span>
                  <h2>{t('composeNeedsCommunity')}</h2>
                </Stack>
                <Inline gap={3} wrap>
                  <Button
                    as="a"
                    data-testid="join-community"
                    href="/community/join/"
                    variant="primary"
                  >
                    {t('joinCommunityCta')}
                  </Button>
                </Inline>
              </Stack>
            </Card>
          ) : null}

          {requiresVerified && session?.user.level === 'anonymous' ? (
            <Banner tone="warning" title={t('composeNeedsVerified')}>
              <Inline gap={3} wrap>
                <Button as="a" variant="primary" href="/me/verify/">
                  {t('goVerify')}
                </Button>
              </Inline>
            </Banner>
          ) : null}

          {/* ---------------------------------------------------------------- */}
          {/* Step progress — 3 pills, reachable by keyboard.                  */}
          {/* ---------------------------------------------------------------- */}
          <nav aria-label={t('composeTitle')} data-testid="composer-steps">
            <ul className="stepper-list">
              {stepOrder.map((step, index) => {
                const label =
                  step === 'type'
                    ? t('composerStep1Label')
                    : step === 'compose'
                      ? t('composerStep2Label')
                      : t('composerStep3Label');
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;
                return (
                  <li key={step}>
                    <Pill
                      active={isActive || isCompleted}
                      aria-current={isActive ? 'step' : undefined}
                      data-step={step}
                      data-step-state={
                        isActive ? 'active' : isCompleted ? 'completed' : 'pending'
                      }
                      onClick={() => dispatch(setDraftStep(step))}
                    >
                      {label}
                    </Pill>
                  </li>
                );
              })}
            </ul>
          </nav>

          {validationIssues.length > 0 ? (
            <Banner
              data-testid="composer-validation-banner"
              tone="warning"
              title={t('composerValidationTitle')}
            >
              <ul>
                {validationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </Banner>
          ) : null}

          {/* ---------------------------------------------------------------- */}
          {/* Step 1 — mode selection as two big Card tiles.                   */}
          {/* ---------------------------------------------------------------- */}
          {draft.step === 'type' ? (
            <Stack gap={3}>
              <Stack gap={1}>
                <span className="overline">{t('composeStepType')}</span>
                <p className="muted">{t('composeCopy')}</p>
              </Stack>
              <Inline gap={3} wrap align="start">
                <ModeCard
                  testId="select-request"
                  active={draft.postType === 'request'}
                  iconName="chat"
                  label={t('requestHelpCta')}
                  onClick={() =>
                    dispatch(mergePostDraft({ postType: 'request', step: 'compose' }))
                  }
                />
                <ModeCard
                  testId="select-offer"
                  active={draft.postType === 'offer'}
                  iconName="health"
                  label={t('offerHelpCta')}
                  onClick={() =>
                    dispatch(mergePostDraft({ postType: 'offer', step: 'compose' }))
                  }
                />
              </Inline>
            </Stack>
          ) : null}

          {/* ---------------------------------------------------------------- */}
          {/* Step 2 — compose form. Single focus per field group.             */}
          {/* ---------------------------------------------------------------- */}
          {draft.step === 'compose' ? (
            <Card variant="raised">
              <Stack gap={4}>
                <Stack gap={1}>
                  <span className="overline">{t('composeStepCompose')}</span>
                  <h2>{draftPostTypeLabel}</h2>
                </Stack>

                <Field
                  label={t('composeCurrentCommunity')}
                  // Only show the "join a community first" nudge when the
                  // user actually has no current community. When a community
                  // is selected, the read-only input speaks for itself and
                  // the hint becomes redundant chrome.
                  hint={currentCommunity ? undefined : t('composeNeedsCommunity')}
                >
                  <input disabled aria-disabled="true" value={currentCommunity?.name ?? ''} />
                </Field>

                {/* Category — Pill row so all options are visible at once. */}
                <fieldset
                  style={{ border: 0, padding: 0, margin: 0 }}
                  aria-labelledby="compose-category-legend"
                >
                  <legend
                    id="compose-category-legend"
                    className="field__label"
                    style={{ padding: 0, marginBottom: 'var(--space-2)' }}
                  >
                    {t('filtersType')}
                  </legend>
                  <Inline gap={2} wrap>
                    {CATEGORIES.map((category) => (
                      <Pill
                        key={category}
                        active={draft.category === category}
                        onClick={() => dispatch(mergePostDraft({ category }))}
                      >
                        {getCategoryLabel(preferences.language, category)}
                      </Pill>
                    ))}
                  </Inline>
                </fieldset>

                <Field label={t('composeTitleLabel')}>
                  <input
                    maxLength={140}
                    onChange={(event) =>
                      dispatch(mergePostDraft({ title: event.target.value }))
                    }
                    value={draft.title}
                  />
                </Field>

                <Field label={t('composeBodyLabel')}>
                  <textarea
                    onChange={(event) =>
                      dispatch(mergePostDraft({ body: event.target.value }))
                    }
                    // Enter-to-advance: plain Enter moves to the preview
                    // step when the draft validates; Shift+Enter keeps the
                    // standard newline behavior. We also respect IME
                    // composition (keyCode 229 / isComposing) so CJK input
                    // isn't interrupted mid-typing.
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing &&
                        isDraftValid
                      ) {
                        event.preventDefault();
                        dispatch(setDraftStep('preview'));
                        // On mobile the keyboard should stay dismissed —
                        // blur the textarea so the soft keyboard closes.
                        (event.target as HTMLTextAreaElement).blur();
                      }
                    }}
                    rows={6}
                    value={draft.body}
                    onFocus={(event) => {
                      // Safe-area fix: keep the publish/preview button above
                      // the soft keyboard on mobile by scrolling the focused
                      // element into view at the end of the viewport. We do
                      // this on focus rather than via CSS only because iOS
                      // Safari ignores env(safe-area-inset-bottom) on focus.
                      (event.target as HTMLTextAreaElement).scrollIntoView({
                        block: 'end',
                        behavior: 'smooth',
                      });
                    }}
                  />
                </Field>

                {/* Speech-to-text: ghost IconButton for primary browser path, */}
                {/* secondary Button for file-upload fallback. */}
                <Inline gap={3} wrap align="center">
                  <IconButton
                    aria-label={t('speechBrowserAction')}
                    data-testid="browser-speech"
                    disabled={!supportsBrowserSpeechRecognition()}
                    onClick={() => void handleBrowserSpeech()}
                    shape="circle"
                    size="md"
                    tone="accent"
                    variant="tonal"
                  >
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
                      <path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11Z" />
                    </svg>
                  </IconButton>
                  <Button
                    onClick={() => audioInputRef.current?.click()}
                    variant="ghost"
                    size="sm"
                  >
                    {t('speechFallbackAction')}
                  </Button>
                  <input
                    ref={audioInputRef}
                    accept="audio/*"
                    hidden
                    onChange={(event) => void handleFallbackAudio(event.target.files?.[0])}
                    type="file"
                  />
                </Inline>
                {browserSpeechError ? (
                  <Banner tone="warning" title={browserSpeechError} />
                ) : null}
                {speechMutation.error ? (
                  <Banner
                    tone="danger"
                    title={
                      speechMutation.error instanceof Error
                        ? speechMutation.error.message
                        : t('speechFallbackAction')
                    }
                  />
                ) : null}

                <div className="form-row">
                  <Field label={t('zipLabel')}>
                    <input
                      onChange={(event) =>
                        dispatch(
                          mergePostDraft({
                            locationZip: event.target.value.replace(/\D/g, '').slice(0, 5),
                          }),
                        )
                      }
                      value={draft.locationZip}
                    />
                  </Field>
                  <Field label={t('composeExpiresLabel')}>
                    <input
                      onChange={(event) =>
                        dispatch(
                          mergePostDraft({
                            expiresAt: fromDateTimeLocalValue(event.target.value),
                          }),
                        )
                      }
                      type="datetime-local"
                      value={toDateTimeLocalValue(draft.expiresAt)}
                    />
                  </Field>
                </div>

                <Field label={t('composePrivacyLabel')} className="field--select">
                  <select
                    onChange={(event) =>
                      dispatch(
                        mergePostDraft({ privacy: event.target.value as typeof draft.privacy }),
                      )
                    }
                    value={draft.privacy}
                  >
                    {PRIVACY_OPTIONS.map((privacy) => (
                      <option key={privacy} value={privacy}>
                        {getPostPrivacyLabel(preferences.language, privacy)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Stack gap={2}>
                  <Checkbox
                    checked={draft.contactPref.inAppChat}
                    label={t('composeContactChat')}
                    onChange={() =>
                      dispatch(
                        mergePostDraft({
                          contactPref: {
                            ...draft.contactPref,
                            inAppChat: !draft.contactPref.inAppChat,
                          },
                        }),
                      )
                    }
                  />
                  <Checkbox
                    checked={draft.contactPref.call}
                    label={t('call')}
                    onChange={() =>
                      dispatch(
                        mergePostDraft({
                          contactPref: { ...draft.contactPref, call: !draft.contactPref.call },
                        }),
                      )
                    }
                  />
                  <Checkbox
                    checked={draft.contactPref.text}
                    label={t('composeContactText')}
                    onChange={() =>
                      dispatch(
                        mergePostDraft({
                          contactPref: { ...draft.contactPref, text: !draft.contactPref.text },
                        }),
                      )
                    }
                  />
                </Stack>

                <Field label={t('notesTitle')}>
                  <textarea
                    onChange={(event) =>
                      dispatch(
                        mergePostDraft({
                          contactPref: { ...draft.contactPref, notes: event.target.value },
                        }),
                      )
                    }
                    rows={3}
                    value={draft.contactPref.notes}
                  />
                </Field>

                <Inline gap={3} wrap>
                  <Button
                    data-testid="preview-post"
                    onClick={() => dispatch(setDraftStep('preview'))}
                    variant="primary"
                  >
                    {t('composeStepPreview')}
                  </Button>
                </Inline>
              </Stack>
            </Card>
          ) : null}

          {/* ---------------------------------------------------------------- */}
          {/* Step 3 — preview. Shows the draft the way it will appear.        */}
          {/* ---------------------------------------------------------------- */}
          {draft.step === 'preview' ? (
            <Stack gap={4}>
              <Stack gap={1}>
                <span className="overline">{t('composeStepPreview')}</span>
                <p className="muted">{t('composeCopy')}</p>
              </Stack>

              <Card variant="accent" aria-labelledby="compose-preview-title">
                <Stack gap={3}>
                  <Inline gap={2} wrap>
                    <Tag tone="community">{draftPostTypeLabel}</Tag>
                    {draftCategoryLabel ? (
                      <Tag tone="accent">{draftCategoryLabel}</Tag>
                    ) : null}
                    <Tag tone="neutral">
                      {getPostPrivacyLabel(preferences.language, draft.privacy)}
                    </Tag>
                  </Inline>
                  <h2 id="compose-preview-title">{draft.title || t('composeTitleLabel')}</h2>
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {draft.body || t('composeBodyLabel')}
                  </p>
                  <Inline gap={2} wrap>
                    <Tag tone="neutral">{draft.locationZip || t('zipLabel')}</Tag>
                    <Tag tone="neutral">
                      {draft.expiresAt
                        ? new Date(draft.expiresAt).toLocaleString()
                        : t('composeExpiresLabel')}
                    </Tag>
                  </Inline>
                </Stack>
              </Card>

              {createPostMutation.error ? (
                <Banner
                  tone="danger"
                  title={
                    createPostMutation.error instanceof Error
                      ? createPostMutation.error.message
                      : t('verifyError')
                  }
                />
              ) : null}

              <Inline gap={3} wrap>
                <Button
                  data-testid="back-to-edit"
                  onClick={() => dispatch(setDraftStep('compose'))}
                  variant="secondary"
                >
                  {t('composerBackToEdit')}
                </Button>
                <Button
                  data-testid="publish-post"
                  disabled={
                    createPostMutation.isPending ||
                    !draft.postType ||
                    !currentCommunity ||
                    !isDraftValid
                  }
                  loading={createPostMutation.isPending}
                  onClick={() => void handlePublish()}
                  variant="primary"
                  // Wave 6C — publishing is the loudest CTA in the app;
                  // tactile confirmation matches the magnitude of the
                  // commitment (posting to the whole community).
                  haptic
                >
                  {createPostMutation.isPending
                    ? t('composePublishing')
                    : t('composePublishAction')}
                </Button>
              </Inline>
            </Stack>
          ) : null}

          {/* Success toast after publish — role=status polite announcement
              that persists until the router.push unmounts this screen. */}
          {publishSuccessToast ? (
            <Toast
              tone="success"
              title={publishSuccessToast}
              data-testid="post-publish-toast"
            />
          ) : null}
        </Stack>
      </div>
    </>
  );
}

/** Big 2-up mode selector tile. Active state uses the accent Card variant. */
type ModeCardProps = {
  testId: string;
  active: boolean;
  iconName: 'chat' | 'health';
  label: string;
  onClick: () => void;
};

function ModeCard({ testId, active, iconName, label, onClick }: ModeCardProps) {
  const classes = ['mode-card', active ? 'mode-card--active' : ''].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      className={classes}
    >
      <Icon name={iconName} size="lg" tone={active ? 'accent' : 'muted'} />
      <span className="mode-card__label">{label}</span>
      {active ? (
        <span aria-hidden="true" className="mode-card__check">
          {'\u2713'}
        </span>
      ) : null}
    </button>
  );
}
