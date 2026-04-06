'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

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
        <section className="hero hero--detail">
          <div className="hero__topbar">
            <span className="hero__eyebrow">{t('composeTitle')}</span>
            <Link className="hero__link" href="/community">
              {t('backHome')}
            </Link>
          </div>
          <h1>{t('composeTitle')}</h1>
          <p>{t('composeCopy')}</p>
        </section>

        {!session ? (
          <section className="card card--verify">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <button className="button button--primary" disabled={creatingSession} onClick={() => void handleCreateSession()} type="button">
                {creatingSession ? t('creatingSession') : t('createSession')}
              </button>
            </div>
          </section>
        ) : null}

        {!currentCommunity ? (
          <section className="card card--verify">
            <div className="result-empty">
              <p>{t('composeNeedsCommunity')}</p>
              <Link className="button button--primary" href="/community/join">
                {t('joinCommunityCta')}
              </Link>
            </div>
          </section>
        ) : null}

        {requiresVerified && session?.user.level === 'anonymous' ? (
          <section className="card card--verify">
            <div className="result-empty">
              <p>{t('composeNeedsVerified')}</p>
              <Link className="button button--primary" href="/verify">
                {t('goVerify')}
              </Link>
            </div>
          </section>
        ) : null}

        <section className="card card--verify">
          <div className="tab-row">
            <button className={`pill ${draft.step === 'type' ? 'pill--active' : ''}`} onClick={() => dispatch(setDraftStep('type'))} type="button">
              {t('composeStepType')}
            </button>
            <button className={`pill ${draft.step === 'compose' ? 'pill--active' : ''}`} onClick={() => dispatch(setDraftStep('compose'))} type="button">
              {t('composeStepCompose')}
            </button>
            <button className={`pill ${draft.step === 'preview' ? 'pill--active' : ''}`} onClick={() => dispatch(setDraftStep('preview'))} type="button">
              {t('composeStepPreview')}
            </button>
          </div>

          {draft.step === 'type' ? (
            <div className="actions">
              <button className={`button ${draft.postType === 'request' ? 'button--primary' : 'button--secondary'}`} onClick={() => dispatch(mergePostDraft({ postType: 'request', step: 'compose' }))} type="button">
                {t('requestHelpCta')}
              </button>
              <button className={`button ${draft.postType === 'offer' ? 'button--primary' : 'button--secondary'}`} onClick={() => dispatch(mergePostDraft({ postType: 'offer', step: 'compose' }))} type="button">
                {t('offerHelpCta')}
              </button>
            </div>
          ) : null}

          {draft.step !== 'type' ? (
            <div className="verify-grid">
              <label className="field">
                <span>{t('composeCurrentCommunity')}</span>
                <input disabled value={currentCommunity?.name ?? ''} />
              </label>

              <label className="field field--select">
                <span>{t('filtersType')}</span>
                <select onChange={(event) => dispatch(mergePostDraft({ category: event.target.value as typeof draft.category }))} value={draft.category}>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {getCategoryLabel(preferences.language, category)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{t('composeTitleLabel')}</span>
                <input onChange={(event) => dispatch(mergePostDraft({ title: event.target.value }))} value={draft.title} />
              </label>

              <label className="field">
                <span>{t('composeBodyLabel')}</span>
                <textarea onChange={(event) => dispatch(mergePostDraft({ body: event.target.value }))} rows={6} value={draft.body} />
              </label>

              <div className="actions">
                <button className="button button--secondary" disabled={!supportsBrowserSpeechRecognition()} onClick={() => void handleBrowserSpeech()} type="button">
                  {t('speechBrowserAction')}
                </button>
                <button className="button button--secondary" onClick={() => audioInputRef.current?.click()} type="button">
                  {t('speechFallbackAction')}
                </button>
                <input ref={audioInputRef} accept="audio/*" hidden onChange={(event) => void handleFallbackAudio(event.target.files?.[0])} type="file" />
              </div>
              {browserSpeechError ? <p className="status-copy status-copy--error">{browserSpeechError}</p> : null}
              {speechMutation.error ? (
                <p className="status-copy status-copy--error">
                  {speechMutation.error instanceof Error ? speechMutation.error.message : t('speechFallbackAction')}
                </p>
              ) : null}

              <div className="grid grid--two">
                <label className="field">
                  <span>{t('zipLabel')}</span>
                  <input onChange={(event) => dispatch(mergePostDraft({ locationZip: event.target.value.replace(/\D/g, '').slice(0, 5) }))} value={draft.locationZip} />
                </label>
                <label className="field">
                  <span>{t('composeExpiresLabel')}</span>
                  <input
                    onChange={(event) =>
                      dispatch(mergePostDraft({ expiresAt: fromDateTimeLocalValue(event.target.value) }))
                    }
                    type="datetime-local"
                    value={toDateTimeLocalValue(draft.expiresAt)}
                  />
                </label>
              </div>

              <label className="field field--select">
                <span>{t('composePrivacyLabel')}</span>
                <select onChange={(event) => dispatch(mergePostDraft({ privacy: event.target.value as typeof draft.privacy }))} value={draft.privacy}>
                  {privacyOptions.map((privacy) => (
                    <option key={privacy} value={privacy}>
                      {getPostPrivacyLabel(preferences.language, privacy)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="toggle-row">
                <label className="checkbox">
                  <input checked={draft.contactPref.inAppChat} onChange={() => dispatch(mergePostDraft({ contactPref: { ...draft.contactPref, inAppChat: !draft.contactPref.inAppChat } }))} type="checkbox" />
                  <span>{t('composeContactChat')}</span>
                </label>
                <label className="checkbox">
                  <input checked={draft.contactPref.call} onChange={() => dispatch(mergePostDraft({ contactPref: { ...draft.contactPref, call: !draft.contactPref.call } }))} type="checkbox" />
                  <span>{t('call')}</span>
                </label>
                <label className="checkbox">
                  <input checked={draft.contactPref.text} onChange={() => dispatch(mergePostDraft({ contactPref: { ...draft.contactPref, text: !draft.contactPref.text } }))} type="checkbox" />
                  <span>{t('composeContactText')}</span>
                </label>
              </div>

              <label className="field">
                <span>{t('notesTitle')}</span>
                <textarea onChange={(event) => dispatch(mergePostDraft({ contactPref: { ...draft.contactPref, notes: event.target.value } }))} rows={3} value={draft.contactPref.notes} />
              </label>

              <div className="actions">
                {draft.step === 'compose' ? (
                  <button className="button button--primary" onClick={() => dispatch(setDraftStep('preview'))} type="button">
                    {t('composeStepPreview')}
                  </button>
                ) : null}
                {draft.step === 'preview' ? (
                  <button className="button button--primary" disabled={createPostMutation.isPending || !draft.postType || !currentCommunity} onClick={() => void handlePublish()} type="button">
                    {createPostMutation.isPending ? t('creatingSession') : t('composePublishAction')}
                  </button>
                ) : null}
              </div>

              {createPostMutation.error ? (
                <p className="status-copy status-copy--error">
                  {createPostMutation.error instanceof Error ? createPostMutation.error.message : t('verifyError')}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
