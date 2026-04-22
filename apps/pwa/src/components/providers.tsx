'use client';

import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

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

// V2-B win #3 — persist react-query's cache to localStorage so return
// visits render the home /resources list from disk on mount (0 network
// RTT) and only revalidate in the background once `staleTime` expires.
// We keep a hard 24h TTL on the persisted cache (`maxAge`) and bump
// `buster` on schema changes so any breaking data-shape update purges
// the stale payload automatically.
//
// `dehydrateOptions.shouldDehydrateQuery` is the escape hatch for the
// sensitive-data rule: only GET-ish resource queries and match inbox
// shapes should hit localStorage. Mutations and auth-bound queries are
// in-memory only (they carry an `accessToken` in their query key, so
// filtering on that excludes them naturally — see CACHEABLE_KEYS below).
const CACHEABLE_PERSISTED_KEYS = new Set([
  'resources',
  'resource',
]);

const PERSISTED_CACHE_BUSTER = 'weavenyc-v2b-2026-04';
const PERSISTED_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export function Providers({ children, initialLanguage }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            // V2-B win #3 — give persisted queries a full 24h window of
            // `gcTime` so rehydrated entries actually stick around in
            // memory after the first render (default `gcTime` is 5min;
            // react-query would otherwise evict them before the user's
            // next navigation).
            gcTime: PERSISTED_CACHE_MAX_AGE_MS,
          },
        },
      }),
  );

  // `createSyncStoragePersister` does a single lazy `localStorage.getItem`
  // per mount and writes back on cache change. SSR-safe: we detect the
  // absence of `window` and hand back `null`, which causes
  // `PersistQueryClientProvider` to silently skip persistence.
  const persister = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return createSyncStoragePersister({
        storage: window.localStorage,
        key: 'weavenyc-query-cache',
        throttleTime: 1000,
      });
    } catch {
      // Private browsing / storage quota / disabled storage all surface as
      // thrown errors on the first `setItem`. Degrade to in-memory cache
      // rather than blocking the entire provider tree.
      return null;
    }
  }, []);

  return (
    <Provider store={store}>
      <ClientBootstrap initialLanguage={initialLanguage}>
        {persister ? (
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister,
              maxAge: PERSISTED_CACHE_MAX_AGE_MS,
              buster: PERSISTED_CACHE_BUSTER,
              dehydrateOptions: {
                // Only dehydrate non-auth resource queries. Everything that
                // carries an accessToken (posts, inbox, conversations) stays
                // in-memory; persisting those would both leak community
                // data across logins and go stale quickly.
                shouldDehydrateQuery: (query) => {
                  if (!Array.isArray(query.queryKey)) return false;
                  const [head] = query.queryKey;
                  return typeof head === 'string' && CACHEABLE_PERSISTED_KEYS.has(head);
                },
              },
            }}
          >
            {children}
          </PersistQueryClientProvider>
        ) : (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )}
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
      // Persisted session never contains access_token (A1 P1-6): we
      // hydrate with an empty access_token string, and useSessionBootstrap
      // will exchange the refresh_token for a fresh access_token on the
      // first mount of a protected screen. Keeping the slice shape
      // identical avoids churn on every consumer; the `access_token`
      // field stays a string (empty → loading) rather than optional.
      if (!storedSession) {
        dispatch(hydrateSession(null));
      } else {
        dispatch(
          hydrateSession({
            access_token: '',
            refresh_token: storedSession.refresh_token,
            user: storedSession.user,
            issued_via: storedSession.issued_via,
            fallback: storedSession.fallback,
          }),
        );
      }
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
