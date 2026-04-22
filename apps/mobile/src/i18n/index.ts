/**
 * i18next + react-i18next initialization for WeaveNYC mobile.
 *
 * SCOPE (M1): seed only. Full string port is M5's job. Today we register
 * EN / ES / zh-Hans and the single `chrome` namespace so the 5-tab shell
 * renders translated tab labels + a "Coming soon" placeholder.
 *
 * Initial locale detection uses expo-localization's `getLocales()` — the
 * first entry is the user's preferred system language. We map its BCP-47
 * tag down to one of our three supported codes; unknown tags fall back to
 * English. The mapping is intentionally coarse (no "es-MX" vs "es-ES"
 * split) because the copy team ships ONE Spanish variant.
 *
 * The `interpolation.escapeValue: false` flag is correct for React —
 * React already escapes values in JSX, so i18next doing a second pass
 * double-escapes accented characters.
 */

import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import chromeEN from '../locales/en/chrome.json';
import chromeES from '../locales/es/chrome.json';
import chromeZH from '../locales/zh-Hans/chrome.json';

export type SupportedLocale = 'en' | 'es' | 'zh-Hans';
const SUPPORTED: SupportedLocale[] = ['en', 'es', 'zh-Hans'];

function detectLocale(): SupportedLocale {
  const locales = Localization.getLocales();
  const first = locales[0]?.languageTag ?? 'en';

  // zh-Hans / zh-CN / zh-Hans-CN all map to simplified Chinese.
  if (first.startsWith('zh-Hans') || first.startsWith('zh-CN')) {
    return 'zh-Hans';
  }
  if (first.startsWith('es')) {
    return 'es';
  }
  if (first.startsWith('en')) {
    return 'en';
  }

  // Fallback: any unsupported tag lands on English.
  return 'en';
}

// Namespace split — matches the PWA's eventual shape so M5 can copy keys
// over without renaming. Only `chrome` has content today; the others
// register empty bundles so `useTranslation('onboarding')` etc. doesn't
// error out at call sites being stubbed in later waves.
export const NAMESPACES = [
  'chrome',
  'onboarding',
  'home',
  'community',
  'posts',
  'chat',
  'me',
  'errors',
] as const;

const resources = {
  en: { chrome: chromeEN },
  es: { chrome: chromeES },
  'zh-Hans': { chrome: chromeZH },
};

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectLocale(),
    fallbackLng: 'en',
    defaultNS: 'chrome',
    ns: NAMESPACES as unknown as string[],
    supportedLngs: SUPPORTED,
    interpolation: {
      // React already escapes JSX values.
      escapeValue: false,
    },
    // react-i18next bindings
    react: {
      useSuspense: false,
    },
  });

export default i18n;
