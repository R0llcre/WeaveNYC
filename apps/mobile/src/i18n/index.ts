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

  await i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    lng: chosen,
    fallbackLng: 'en',
    defaultNS: 'chrome',
    ns: EAGER_NAMESPACES,
    resources: {
      en: { chrome: enChrome, errors: enErrors },
      es: { chrome: esChrome, errors: esErrors },
      'zh-Hans': { chrome: zhChrome, errors: zhErrors },
    },
    interpolation: {
      // react-native escapes on render; i18next-level escaping is unwanted.
      escapeValue: false,
      prefix: '{',
      suffix: '}',
    },
    returnNull: false,
  });

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
  const [en, es, zh] = await Promise.all([
    import(`../locales/en/${namespace}.json`),
    import(`../locales/es/${namespace}.json`),
    import(`../locales/zh-Hans/${namespace}.json`),
  ]);
  i18n.addResourceBundle('en', namespace, en.default ?? en, true, false);
  i18n.addResourceBundle('es', namespace, es.default ?? es, true, false);
  i18n.addResourceBundle('zh-Hans', namespace, zh.default ?? zh, true, false);
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

export default i18n;
