'use client';

import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { coerceSupportedLanguage, messages } from '@/lib/i18n';
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
import { hydratePreferences } from '@/lib/slices/preferences-slice';
import { store } from '@/lib/store';
import type { SupportedLanguage } from '@/lib/types';

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
  const preferences = useAppSelector((state) => state.preferences);
  const session = useAppSelector((state) => state.auth.session);
  const community = useAppSelector((state) => state.community);
  const postDraft = useAppSelector((state) => state.postDraft);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [storedPreferences, storedSession, storedCommunity, storedPostDraft] = await Promise.all([
        loadPreferences(),
        loadSession(),
        loadCommunityState(),
        loadPostDraft(),
      ]);

      if (cancelled) {
        return;
      }

      dispatch(
        hydratePreferences({
          ...storedPreferences,
          language: storedPreferences?.language ?? coerceSupportedLanguage(navigator?.language ?? initialLanguage),
        }),
      );
      dispatch(hydrateSession(storedSession));
      dispatch(hydrateCommunity(storedCommunity));
      dispatch(hydratePostDraft(storedPostDraft));
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void savePreferences(preferences);
  }, [hydrated, preferences]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void saveSession(session);
  }, [hydrated, session]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void saveCommunityState(community);
  }, [community, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const hasContent = Boolean(postDraft.postType || postDraft.title || postDraft.body || postDraft.locationZip);
    if (!hasContent) {
      void clearPostDraft();
      return;
    }

    void savePostDraft(postDraft);
  }, [hydrated, postDraft]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.lang = preferences.language;
  }, [preferences.language]);

  return (
    <NextIntlClientProvider
      locale={preferences.language}
      messages={messages[preferences.language]}
      timeZone="America/New_York"
    >
      {children}
    </NextIntlClientProvider>
  );
}
