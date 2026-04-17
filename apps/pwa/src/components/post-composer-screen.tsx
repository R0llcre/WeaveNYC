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
import { listenOnceWithBrowserSpeech, supportsBrowserSpeechRecognition } from '@/lib/speech';
import { setSession } from '@/lib/slices/auth-slice';
import { mergePostDraft, resetPostDraft, setDraftStep } from '@/lib/slices/post-draft-slice';

const categories = ['food', 'goods', 'childcare', 'companionship', 'translation', 'transportation', 'other'] as const;
const privacyOptions = ['community_only', 'public', 'anchor_mediated'] as const;

export function PostComposerScreen() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.auth.session);
  const preferences = useAppSelector((state) => state.preferences);
  const communityState = useAppSelector((state) => state.community);
  const draft = useAppSelector((state) => state.postDraft);
  const [creatingSession, setCreatingSession] = useState(false);
  const [browserSpeechError, setBrowserSpeechError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const draftBodyRef = useRef(draft.body);
  const createPostMutation = useCreatePost(session?.access_token);
  const speechMutation = useSpeechTranscribe(session?.access_token);

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

  useEffect(() => {
    draftBodyRef.current = draft.body;
  }, [draft.body]);

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
      const transcript = await listenOnceWithBrowserSpeech(preferences.language);
      dispatch(mergePostDraft({ body: [draftBodyRef.current, transcript].filter(Boolean).join('\n').trim() }));
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
    dispatch(mergePostDraft({ body: [draftBodyRef.current, result.transcript].filter(Boolean).join('\n').trim() }));
  };

  const handlePublish = async () => {
    if (!session?.access_token || !currentCommunity || !draft.postType) {
      return;
    }

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

  return (
    <main className="shell">
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
                disabled={creatingSession}
                onClick={() => void handleCreateSession()}
                variant="primary"
              >
                {creatingSession ? t('creatingSession') : t('createSession')}
              </Button>
            </div>
          </Card>
        ) : null}

        {!currentCommunity ? (
          <Card variant="raised">
            <div className="result-empty">
              <p>{t('composeNeedsCommunity')}</p>
              <Link className="button button--primary" data-testid="join-community" href="/community/join">
                {t('joinCommunityCta')}
              </Link>
            </div>
          </Card>
        ) : null}

        {requiresVerified && session?.user.level === 'anonymous' ? (
          <Banner tone="warning" title={t('composeNeedsVerified')}>
            <div className="actions">
              <Link className="button button--primary" href="/verify">
                {t('goVerify')}
              </Link>
            </div>
          </Banner>
        ) : null}

        <Card variant="raised">
          <nav aria-label={t('composeTitle')} className="tab-row">
            <Pill
              active={draft.step === 'type'}
              onClick={() => dispatch(setDraftStep('type'))}
            >
              {t('composeStepType')}
            </Pill>
            <Pill
              active={draft.step === 'compose'}
              onClick={() => dispatch(setDraftStep('compose'))}
            >
              {t('composeStepCompose')}
            </Pill>
            <Pill
              active={draft.step === 'preview'}
              onClick={() => dispatch(setDraftStep('preview'))}
            >
              {t('composeStepPreview')}
            </Pill>
          </nav>

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
              <Field label={t('composeCurrentCommunity')}>
                <input disabled value={currentCommunity?.name ?? ''} />
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
                  <Button
                    data-testid="publish-post"
                    disabled={createPostMutation.isPending || !draft.postType || !currentCommunity}
                    onClick={() => void handlePublish()}
                    variant="primary"
                  >
                    {createPostMutation.isPending ? t('creatingSession') : t('composePublishAction')}
                  </Button>
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
