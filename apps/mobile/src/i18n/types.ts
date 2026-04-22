/**
 * Type-safe bindings for `react-i18next` against the generated namespace JSON.
 *
 * We import the EN JSON directly and let TypeScript infer the shape — that
 * way the types always match what's on disk without a separate `.d.ts`
 * generation step. ES and ZH are validated at runtime by
 * `scripts/i18n-parity.ts`, not at the type level, so a missing ES key is a
 * CI failure rather than a compile error (this matches how react-i18next
 * resolves fallback languages anyway).
 *
 * Module augmentation below teaches `useTranslation('home').t('wizardTitle')`
 * to autocomplete from the JSON and reject typos at the compile step.
 */
import type accessibility from '../locales/en/accessibility.json';
import type chat from '../locales/en/chat.json';
import type chrome from '../locales/en/chrome.json';
import type community from '../locales/en/community.json';
import type errors from '../locales/en/errors.json';
import type home from '../locales/en/home.json';
import type me from '../locales/en/me.json';
import type onboarding from '../locales/en/onboarding.json';
import type posts from '../locales/en/posts.json';
import type privacy from '../locales/en/privacy.json';
import type tickers from '../locales/en/tickers.json';
import type verify from '../locales/en/verify.json';

export interface Resources {
  accessibility: typeof accessibility;
  chat: typeof chat;
  chrome: typeof chrome;
  community: typeof community;
  errors: typeof errors;
  home: typeof home;
  me: typeof me;
  onboarding: typeof onboarding;
  posts: typeof posts;
  privacy: typeof privacy;
  tickers: typeof tickers;
  verify: typeof verify;
}

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'chrome';
    resources: Resources;
    // Keep all string returns — we don't use objects in values anywhere
    // in the PWA port, so returnNull: false + returnObjects: false matches
    // the bootstrap config.
    returnNull: false;
  }
}
