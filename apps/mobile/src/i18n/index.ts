/**
 * react-i18next bootstrap for the mobile app.
 *
 * Responsibilities:
 *   1. Detect the device locale via `expo-localization` and normalise it to
 *      one of our three internal locales (`en` / `es` / `zh-Hans`).
 *   2. Persist the user's locale choice with `react-native-mmkv` so it
 *      survives app restart.
 *   3. Load `chrome` + `errors` eagerly (they appear on every route) and
 *      defer the rest to per-screen `loadNamespace()` calls.
 *
 * Note: M1 scaffolds `expo-localization` and `react-native-mmkv` into
 * package.json. This file uses dynamic `require()` so `node apps/mobile/...`
 * style tooling (e.g. the parity script, ts-node typecheck) doesn't choke on
 * native-only deps before the Expo plugin config runs.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enChrome from '../locales/en/chrome.json';
import enErrors from '../locales/en/errors.json';
import esChrome from '../locales/es/chrome.json';
import esErrors from '../locales/es/errors.json';
import zhChrome from '../locales/zh-Hans/chrome.json';
import zhErrors from '../locales/zh-Hans/errors.json';

// Metro doesn't support dynamic `import(\`./path/${variable}.json\`)` —
// the bundler needs static imports so it can include each JSON blob in
// the iOS archive. Originally `loadNamespace()` lazy-loaded non-eager
// bundles via a template-string import, but the ~12KB × 9 deferred JSON
// files fit in the app budget, so we just eager-import everything and
// register the bundles on i18n init. The public `loadNamespace()` shim
// below keeps its promise-returning signature so existing callers
// (screens that await before rendering translated strings) work
// unchanged; every namespace is already mounted when init completes.
import enAccessibility from '../locales/en/accessibility.json';
import esAccessibility from '../locales/es/accessibility.json';
import zhAccessibility from '../locales/zh-Hans/accessibility.json';
import enChat from '../locales/en/chat.json';
import esChat from '../locales/es/chat.json';
import zhChat from '../locales/zh-Hans/chat.json';
import enCommunity from '../locales/en/community.json';
import esCommunity from '../locales/es/community.json';
import zhCommunity from '../locales/zh-Hans/community.json';
import enHome from '../locales/en/home.json';
import esHome from '../locales/es/home.json';
import zhHome from '../locales/zh-Hans/home.json';
import enMe from '../locales/en/me.json';
import esMe from '../locales/es/me.json';
import zhMe from '../locales/zh-Hans/me.json';
import enOnboarding from '../locales/en/onboarding.json';
import esOnboarding from '../locales/es/onboarding.json';
import zhOnboarding from '../locales/zh-Hans/onboarding.json';
import enPosts from '../locales/en/posts.json';
import esPosts from '../locales/es/posts.json';
import zhPosts from '../locales/zh-Hans/posts.json';
import enPrivacy from '../locales/en/privacy.json';
import esPrivacy from '../locales/es/privacy.json';
import zhPrivacy from '../locales/zh-Hans/privacy.json';
import enTickers from '../locales/en/tickers.json';
import esTickers from '../locales/es/tickers.json';
import zhTickers from '../locales/zh-Hans/tickers.json';
import enVerify from '../locales/en/verify.json';
import esVerify from '../locales/es/verify.json';
import zhVerify from '../locales/zh-Hans/verify.json';

const ALL_BUNDLES: Record<string, Record<'en' | 'es' | 'zh-Hans', unknown>> = {
  accessibility: { en: enAccessibility, es: esAccessibility, 'zh-Hans': zhAccessibility },
  chat: { en: enChat, es: esChat, 'zh-Hans': zhChat },
  community: { en: enCommunity, es: esCommunity, 'zh-Hans': zhCommunity },
  home: { en: enHome, es: esHome, 'zh-Hans': zhHome },
  me: { en: enMe, es: esMe, 'zh-Hans': zhMe },
  onboarding: { en: enOnboarding, es: esOnboarding, 'zh-Hans': zhOnboarding },
  posts: { en: enPosts, es: esPosts, 'zh-Hans': zhPosts },
  privacy: { en: enPrivacy, es: esPrivacy, 'zh-Hans': zhPrivacy },
  tickers: { en: enTickers, es: esTickers, 'zh-Hans': zhTickers },
  verify: { en: enVerify, es: esVerify, 'zh-Hans': zhVerify },
};

export type AppLocale = 'en' | 'es' | 'zh-Hans';

// Every namespace JSON file that lives under `src/locales/<locale>/`.
// Keep this list in sync with `apps/mobile/scripts/i18n-parity.ts` — the
// parity script reads the filesystem, not this constant, so it will fail
// loudly if the two drift.
export const NAMESPACES = [
  'accessibility',
  'chat',
  'chrome',
  'community',
  'errors',
  'home',
  'me',
  'onboarding',
  'posts',
  'privacy',
  'tickers',
  'verify',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

// Namespaces loaded at boot. Everything else is code-split and loaded per
// route via `loadNamespace()`.
export const EAGER_NAMESPACES: Namespace[] = ['chrome', 'errors'];

const LOCALE_STORAGE_KEY = 'weavenyc.mobile.locale.v1';

/**
 * Normalise an IETF language tag to one of our three internal locales.
 *
 * Rules:
 *   - Anything starting with `es` (es, es-MX, es-US) → `es`.
 *   - `zh-Hans`, `zh-CN`, `zh-SG` → `zh-Hans` directly.
 *   - `zh-Hant`, `zh-TW`, `zh-HK` → `zh-Hans` with a console note (we don't
 *     ship a Traditional bundle yet; swap this to `zh-Hant` when we do).
 *   - Everything else → `en`.
 */
export function coerceLocale(tag: string | null | undefined): AppLocale {
  const lower = (tag ?? '').toLowerCase();
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('zh-hant') || lower.startsWith('zh-tw') || lower.startsWith('zh-hk')) {
    console.info('[i18n] zh-Hant detected; falling back to zh-Hans bundle');
    return 'zh-Hans';
  }
  if (lower.startsWith('zh')) return 'zh-Hans';
  return 'en';
}

interface Storage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

// Lazy MMKV — required() inside the function so test/preview targets that
// don't set up native modules don't blow up at import-time.
let _storage: Storage | null = null;
function getStorage(): Storage | null {
  if (_storage) return _storage;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as { MMKV: new () => Storage };
    _storage = new MMKV();
    return _storage;
  } catch {
    return null;
  }
}

function detectDeviceLocale(): AppLocale {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require('expo-localization') as {
      getLocales?: () => Array<{ languageTag?: string }>;
    };
    const tag = expo.getLocales?.()?.[0]?.languageTag;
    return coerceLocale(tag);
  } catch {
    return 'en';
  }
}

/**
 * Read the persisted locale. Returns null if nothing was saved (first run).
 */
export function getPersistedLocale(): AppLocale | null {
  const raw = getStorage()?.getString(LOCALE_STORAGE_KEY);
  if (raw === 'en' || raw === 'es' || raw === 'zh-Hans') return raw;
  return null;
}

export function persistLocale(locale: AppLocale): void {
  getStorage()?.set(LOCALE_STORAGE_KEY, locale);
}

/**
 * Initialise i18next with only the eager namespaces. Later, per-route
 * components call `await loadNamespace('home')` to hydrate the rest.
 *
 * Safe to call multiple times — i18next's `init()` is idempotent when the
 * instance is already initialised.
 */
export async function initI18n(overrideLocale?: AppLocale): Promise<typeof i18n> {
  if (i18n.isInitialized) return i18n;

  const chosen = overrideLocale ?? getPersistedLocale() ?? detectDeviceLocale();

  // Build full per-locale resource map up-front. Every namespace JSON is
  // already statically imported above (Metro can't do the dynamic
  // template-string variant), so the cost of bundling everything into the
  // init call is just object construction — the bytes are already in
  // memory. This sidesteps the previous lazy-load race where a screen's
  // `useEffect` call to `loadNamespace()` could fire before `init()`
  // resolved, leaving the bundle silently un-registered and
  // `useTranslation()` returning the raw key.
  const enResources: Record<string, unknown> = { chrome: enChrome, errors: enErrors };
  const esResources: Record<string, unknown> = { chrome: esChrome, errors: esErrors };
  const zhResources: Record<string, unknown> = { chrome: zhChrome, errors: zhErrors };
  for (const ns of Object.keys(ALL_BUNDLES)) {
    const triple = ALL_BUNDLES[ns];
    if (triple) {
      enResources[ns] = triple.en;
      esResources[ns] = triple.es;
      zhResources[ns] = triple['zh-Hans'];
    }
  }

  // i18next's overloaded `init(options)` vs `init(callback)` confuses TS
  // when the options object includes wider `string[]` namespaces; cast the
  // whole options blob to bypass overload selection.
  const initOptions = {
    compatibilityJSON: 'v4',
    lng: chosen,
    fallbackLng: 'en',
    defaultNS: 'chrome',
    ns: NAMESPACES as unknown as string[],
    resources: {
      en: enResources,
      es: esResources,
      'zh-Hans': zhResources,
    },
    interpolation: {
      // react-native escapes on render; i18next-level escaping is unwanted.
      escapeValue: false,
      prefix: '{',
      suffix: '}',
    },
    returnNull: false,
  } as Parameters<typeof i18n.init>[0];
  await i18n.use(initReactI18next).init(initOptions);

  return i18n;
}

/**
 * Dynamic import of a non-eager namespace. Call once per route before
 * rendering translated content. Subsequent calls with the same namespace
 * are a no-op.
 */
const loaded = new Set<string>();
export async function loadNamespace(namespace: Namespace): Promise<void> {
  if (EAGER_NAMESPACES.includes(namespace)) return;
  if (loaded.has(namespace)) return;
  const bundles = ALL_BUNDLES[namespace];
  if (bundles) {
    i18n.addResourceBundle('en', namespace, bundles.en, true, false);
    i18n.addResourceBundle('es', namespace, bundles.es, true, false);
    i18n.addResourceBundle('zh-Hans', namespace, bundles['zh-Hans'], true, false);
  }
  loaded.add(namespace);
}

/**
 * Change the active locale and persist it. Returns the new locale.
 */
export async function setLocale(locale: AppLocale): Promise<AppLocale> {
  persistLocale(locale);
  await i18n.changeLanguage(locale);
  return locale;
}

// Fire-and-forget kickoff — `_layout.tsx` does `import '@/i18n'` as a
// side-effect import expecting the instance to be registered by first
// render. `i18n.use(initReactI18next)` registers synchronously even
// though `.init()` is async, so `useTranslation()` finds the instance
// from the first render; resource loading then resolves on the next
// tick and react-i18next re-renders with the real strings.
void initI18n();

export default i18n;
