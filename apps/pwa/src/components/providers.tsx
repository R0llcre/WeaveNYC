'use client';

import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { coerceSupportedLanguage, messages } from '@/lib/i18n';
import {
  selectCommunity,
  selectPostDraft,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import {
  clearPostDraft,
  loadCommunityState,
  loadPostDraft,
  loadPreferences,
  loadSession,
  saveCommunityState,
  savePostDraft,
  savePreferences,
  saveSession,
} from '@/lib/persistence';
import { hydrateSession } from '@/lib/slices/auth-slice';
import { hydrateCommunity } from '@/lib/slices/community-slice';
import { hydratePostDraft } from '@/lib/slices/post-draft-slice';
import {
  applyDetectedLanguage,
  hydratePreferences,
} from '@/lib/slices/preferences-slice';
import { store } from '@/lib/store';
import type { SupportedLanguage } from '@/lib/types';

/**
 * Pick the best locale for a user who has never set a language. We look
 * at `navigator.languages` (ordered by user preference) first, then
 * `navigator.language`, and fall back to the SSR-provided `initialLanguage`
 * (which itself reads the `Accept-Language` header via middleware). The
 * first entry that maps to a supported language (`en`/`es`/`zh`) wins.
 */
function detectBrowserLanguage(
  fallback: SupportedLanguage,
): SupportedLanguage {
  if (typeof navigator === 'undefined') {
    return fallback;
  }

  const candidates: string[] = [];
  if (Array.isArray(navigator.languages)) {
    candidates.push(...navigator.languages.filter((value): value is string => typeof value === 'string'));
  }
  if (typeof navigator.language === 'string') {
    candidates.push(navigator.language);
  }

  for (const candidate of candidates) {
    const locale = candidate.toLowerCase();
    if (locale === 'zh' || locale.startsWith('zh-') || locale.startsWith('zh_')) {
      return 'zh';
    }
    if (locale === 'es' || locale.startsWith('es-') || locale.startsWith('es_')) {
      return 'es';
    }
    if (locale === 'en' || locale.startsWith('en-') || locale.startsWith('en_')) {
      return 'en';
    }
  }

  return coerceSupportedLanguage(candidates[0] ?? fallback);
}

type ProvidersProps = {
  children: ReactNode;
  initialLanguage: SupportedLanguage;
};

export function Providers({ children, initialLanguage }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <Provider store={store}>
      <ClientBootstrap initialLanguage={initialLanguage}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ClientBootstrap>
    </Provider>
  );
}

function ClientBootstrap({ children, initialLanguage }: ProvidersProps) {
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  const community = useAppSelector(selectCommunity);
  const postDraft = useAppSelector(selectPostDraft);
  // Per-slice hydration flags — each IndexedDB read is fire-and-forget so a
  // fast slice (e.g. preferences) can unblock the UI while a slow one
  // (community, which also reads the joinedCommunities table) is still in
  // flight. Without this, the previous Promise.all on 4 reads blocked the
  // first meaningful paint for 300-500ms on mid-tier Android.
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [communityHydrated, setCommunityHydrated] = useState(false);
  const [postDraftHydrated, setPostDraftHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Preferences hydration still runs the language-detection decision tree
    // against the stored payload because the result is what `hydratePreferences`
    // reducer needs. But we no longer await the other three slices before
    // flipping `hydrationComplete`, so the onboarding guard in ResourceHome
    // fires as soon as preferences land.
    void loadPreferences().then((storedPreferences) => {
      if (cancelled) return;

      const hasStoredChoice = Boolean(
        storedPreferences?.hasUserChosenLanguage || storedPreferences?.language,
      );

      const initialDetectedLanguage = hasStoredChoice
        ? (storedPreferences?.language ?? initialLanguage)
        : detectBrowserLanguage(initialLanguage);

      dispatch(
        hydratePreferences({
          ...storedPreferences,
          language: initialDetectedLanguage,
          hasUserChosenLanguage: Boolean(storedPreferences?.hasUserChosenLanguage),
        }),
      );

      if (!hasStoredChoice) {
        const detected = detectBrowserLanguage(initialLanguage);
        dispatch(applyDetectedLanguage(detected));
      }

      setPreferencesHydrated(true);
    });

    void loadSession().then((storedSession) => {
      if (cancelled) return;
      dispatch(hydrateSession(storedSession));
      setSessionHydrated(true);
    });

    void loadCommunityState().then((storedCommunity) => {
      if (cancelled) return;
      dispatch(hydrateCommunity(storedCommunity));
      setCommunityHydrated(true);
    });

    void loadPostDraft().then((storedPostDraft) => {
      if (cancelled) return;
      dispatch(hydratePostDraft(storedPostDraft));
      setPostDraftHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch, initialLanguage]);

  // Per-slice save effects gate on their own hydration flag so that a fast
  // preferences hydration can start persisting user edits immediately without
  // waiting on the slowest slice to finish loading.
  useEffect(() => {
    if (!preferencesHydrated) return;
    void savePreferences(preferences);
  }, [preferencesHydrated, preferences]);

  useEffect(() => {
    if (!sessionHydrated) return;
    void saveSession(session);
  }, [sessionHydrated, session]);

  useEffect(() => {
    if (!communityHydrated) return;
    void saveCommunityState(community);
  }, [communityHydrated, community]);

  useEffect(() => {
    if (!postDraftHydrated) return;
    const hasContent = Boolean(postDraft.postType || postDraft.title || postDraft.body || postDraft.locationZip);
    if (!hasContent) {
      void clearPostDraft();
      return;
    }
    void savePostDraft(postDraft);
  }, [postDraftHydrated, postDraft]);

  // G5: keep <html lang> in sync with the active UI language. The SSG
  // shell emits `<html lang="en">` (static export cannot inject Redux
  // state at render time), so without this effect screen readers and the
  // `:lang()` CSS pseudo-class stay on English even after a ZH/ES user
  // flips the picker. Guard against `preferences.language` being empty
  // during the very first render — the slice default is 'en' so this is
  // defensive but avoids ever writing `lang=""`.
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const nextLang = preferences.language || 'en';
    if (document.documentElement.lang !== nextLang) {
      document.documentElement.lang = nextLang;
    }
  }, [preferences.language]);

  // `key={preferences.language}` forces a remount when the language slice
  // changes. `NextIntlClientProvider` publishes the locale/messages via
  // context, and while it will re-render with new props, some descendants
  // cache `useTranslations` results against the old context instance. A
  // controlled remount is the cheapest, most reliable way to flip every
  // `useTranslations` consumer to the newly selected language after a user
  // picks ZH/ES on /onboarding/language — guarantees /onboarding/location
  // and every page afterwards shows the new language.
  return (
    <NextIntlClientProvider
      key={preferences.language}
      locale={preferences.language}
      messages={messages[preferences.language]}
      timeZone="America/New_York"
    >
      {children}
    </NextIntlClientProvider>
  );
}
