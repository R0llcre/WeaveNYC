'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Banner, Button, Card, Checkbox, Field, PageHeader, Pill } from '@/components/ui';
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

const categories: readonly PostCategory[] = [
  'food',
  'goods',
  'childcare',
  'companionship',
  'translation',
  'transportation',
  'other',
] as const;
const privacyOptions = ['community_only', 'public', 'anchor_mediated'] as const;

type ValidationMessages = {
  composerValidationEmptyTitle: string;
  composerValidationLongTitle: string;
  composerValidationEmptyBody: string;
  composerValidationLongBody: string;
  composerValidationNoCategory: string;
  composerValidationNoZip: string;
  composerValidationExpired: string;
};

function validateDraft(
  draft: PostDraftState,
  messages: ValidationMessages,
): string[] {
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

  if (!draft.category || !categories.includes(draft.category)) {
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

    // Bug #1 fix: run client-side validation before the mutation. If any
    // required field is missing/invalid, surface the issues and bounce the
    // user back to the compose step without clearing the draft.
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
    router.push(`/posts/${created.post_id}`);
  };

  // Bug #2: map current step to the linear progress breadcrumb.
  const stepOrder: Array<'type' | 'compose' | 'preview'> = ['type', 'compose', 'preview'];
  const currentStepIndex = stepOrder.indexOf(draft.step);

  return (
    <main className="shell" id="main-content" tabIndex={-1}>
      <div className="shell__inner">
        <PageHeader
          eyebrow={t('composeTitle')}
          title={t('composeTitle')}
          subtitle={t('composeCopy')}
          actions={
            <Link className="hero__link" href="/community">
              {t('backHome')}
            </Link>
          }
        />

        {!session ? (
          <Card variant="raised">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <Button
                data-testid="create-session"
                disabled={isCreatingSession}
                onClick={() => void handleCreateSession()}
                variant="primary"
              >
                {isCreatingSession ? t('creatingSession') : t('createSession')}
              </Button>
            </div>
          </Card>
        ) : null}

        {!currentCommunity ? (
          <Card variant="raised">
            <div className="result-empty">
              <p>{t('composeNeedsCommunity')}</p>
              <Button as="a" variant="primary" data-testid="join-community" href="/community/join">
                {t('joinCommunityCta')}
              </Button>
            </div>
          </Card>
        ) : null}

        {requiresVerified && session?.user.level === 'anonymous' ? (
          <Banner tone="warning" title={t('composeNeedsVerified')}>
            <div className="actions">
              <Button as="a" variant="primary" href="/verify">
                {t('goVerify')}
              </Button>
            </div>
          </Banner>
        ) : null}

        <Card variant="raised">
          {/* Bug #2 fix: linear breadcrumb progress. Steps prior to the
              current one are marked completed; the current step is active;
              future steps remain muted. */}
          <nav
            aria-label={t('composeTitle')}
            className="tab-row tab-row--steps"
            data-testid="composer-steps"
          >
            {stepOrder.map((step, index) => {
              const label =
                step === 'type'
                  ? t('composerStep1Label')
                  : step === 'compose'
                    ? t('composerStep2Label')
                    : t('composerStep3Label');
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              const stepClass = [
                'pill--step',
                isCompleted ? 'pill--step-completed' : '',
                isActive ? 'pill--step-active' : '',
                !isActive && !isCompleted ? 'pill--step-pending' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <Pill
                  key={step}
                  active={isActive || isCompleted}
                  aria-current={isActive ? 'step' : undefined}
                  className={stepClass}
                  data-step={step}
                  data-step-state={isActive ? 'active' : isCompleted ? 'completed' : 'pending'}
                  onClick={() => dispatch(setDraftStep(step))}
                >
                  {label}
                </Pill>
              );
            })}
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

          {draft.step === 'type' ? (
            <div className="actions">
              <Button
                data-testid="select-request"
                onClick={() => dispatch(mergePostDraft({ postType: 'request', step: 'compose' }))}
                variant={draft.postType === 'request' ? 'primary' : 'secondary'}
              >
                {t('requestHelpCta')}
              </Button>
              <Button
                data-testid="select-offer"
                onClick={() => dispatch(mergePostDraft({ postType: 'offer', step: 'compose' }))}
                variant={draft.postType === 'offer' ? 'primary' : 'secondary'}
              >
                {t('offerHelpCta')}
              </Button>
            </div>
          ) : null}

          {draft.step !== 'type' ? (
            <div className="verify-grid">
              {/* F10 Fix 10: disabled input explains why it is read-only via
                  the Field hint. The community is bound to the active session
                  and cannot be changed from the composer. */}
              <Field
                label={t('composeCurrentCommunity')}
                hint={t('composeNeedsCommunity')}
              >
                <input
                  disabled
                  aria-disabled="true"
                  value={currentCommunity?.name ?? ''}
                />
              </Field>

              <Field label={t('filtersType')} className="field--select">
                <select
                  onChange={(event) => dispatch(mergePostDraft({ category: event.target.value as typeof draft.category }))}
                  value={draft.category}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {getCategoryLabel(preferences.language, category)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('composeTitleLabel')}>
                <input
                  maxLength={140}
                  onChange={(event) => dispatch(mergePostDraft({ title: event.target.value }))}
                  value={draft.title}
                />
              </Field>

              <Field label={t('composeBodyLabel')}>
                <textarea
                  onChange={(event) => dispatch(mergePostDraft({ body: event.target.value }))}
                  rows={6}
                  value={draft.body}
                />
              </Field>

              <div className="actions">
                <Button
                  data-testid="browser-speech"
                  disabled={!supportsBrowserSpeechRecognition()}
                  onClick={() => void handleBrowserSpeech()}
                  variant="secondary"
                >
                  {t('speechBrowserAction')}
                </Button>
                <Button
                  onClick={() => audioInputRef.current?.click()}
                  variant="secondary"
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
              </div>
              {browserSpeechError ? <p className="status-copy status-copy--error">{browserSpeechError}</p> : null}
              {speechMutation.error ? (
                <p className="status-copy status-copy--error">
                  {speechMutation.error instanceof Error ? speechMutation.error.message : t('speechFallbackAction')}
                </p>
              ) : null}

              <div className="grid grid--two">
                <Field label={t('zipLabel')}>
                  <input
                    onChange={(event) =>
                      dispatch(mergePostDraft({ locationZip: event.target.value.replace(/\D/g, '').slice(0, 5) }))
                    }
                    value={draft.locationZip}
                  />
                </Field>
                <Field label={t('composeExpiresLabel')}>
                  <input
                    onChange={(event) =>
                      dispatch(mergePostDraft({ expiresAt: fromDateTimeLocalValue(event.target.value) }))
                    }
                    type="datetime-local"
                    value={toDateTimeLocalValue(draft.expiresAt)}
                  />
                </Field>
              </div>

              <Field label={t('composePrivacyLabel')} className="field--select">
                <select
                  onChange={(event) => dispatch(mergePostDraft({ privacy: event.target.value as typeof draft.privacy }))}
                  value={draft.privacy}
                >
                  {privacyOptions.map((privacy) => (
                    <option key={privacy} value={privacy}>
                      {getPostPrivacyLabel(preferences.language, privacy)}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="toggle-row">
                <Checkbox
                  checked={draft.contactPref.inAppChat}
                  label={t('composeContactChat')}
                  onChange={() =>
                    dispatch(
                      mergePostDraft({
                        contactPref: { ...draft.contactPref, inAppChat: !draft.contactPref.inAppChat },
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
              </div>

              <Field label={t('notesTitle')}>
                <textarea
                  onChange={(event) =>
                    dispatch(
                      mergePostDraft({ contactPref: { ...draft.contactPref, notes: event.target.value } }),
                    )
                  }
                  rows={3}
                  value={draft.contactPref.notes}
                />
              </Field>

              <div className="actions">
                {draft.step === 'compose' ? (
                  <Button
                    data-testid="preview-post"
                    onClick={() => dispatch(setDraftStep('preview'))}
                    variant="primary"
                  >
                    {t('composeStepPreview')}
                  </Button>
                ) : null}
                {draft.step === 'preview' ? (
                  <>
                    {/* Bug #4 fix: always expose a "Back to edit" affordance
                        while previewing so users can recover from server
                        errors (e.g. risk-too-high 422) without losing their
                        draft. */}
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
                      onClick={() => void handlePublish()}
                      variant="primary"
                    >
                      {createPostMutation.isPending
                        ? t('creatingSession')
                        : t('composePublishAction')}
                    </Button>
                  </>
                ) : null}
              </div>

              {createPostMutation.error ? (
                <p className="status-copy status-copy--error">
                  {createPostMutation.error instanceof Error ? createPostMutation.error.message : t('verifyError')}
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
