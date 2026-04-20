import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

import { Providers } from '@/components/providers';
import { PwaRegistration } from '@/components/pwa-registration';
import { RouteGuards, ShellFrame } from '@/components/shell';
import { messages } from '@/lib/i18n';

import './globals.css';

/**
 * Wire next/font so the design-token CSS custom properties referenced by
 * `globals.css` resolve to self-hosted, subsetted web fonts rather than
 * falling back to `system-ui`. `display: 'swap'` ensures text remains
 * visible during font load (LCP-safe).
 *
 * Editorial 朱砂 stack:
 *   - Fraunces (variable serif)  → display / headlines / brand mark
 *   - Inter (sans)               → body, labels, nav chrome
 *   - Noto Serif SC              → Chinese display fallback
 *   - Noto Sans SC               → Chinese body fallback
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'opsz'],
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const notoSerifSC = Noto_Serif_SC({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-noto-serif-sc',
  display: 'swap',
});
const notoSansSC = Noto_Sans_SC({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-noto-sans-sc',
  display: 'swap',
});

// Static-export compatible: language is negotiated client-side via the
// preferences slice. Initial shell lang attribute is 'en' for the HTML
// document, which matches the default UI locale until hydration.
// `providers.tsx` re-applies `document.documentElement.lang` whenever the
// selected language changes, so screen readers pick up the new language
// after hydration even when the SSG shell starts in English.
const INITIAL_LANGUAGE = 'en';

export const metadata: Metadata = {
  title: 'WeaveNYC PWA',
  description: 'WeaveNYC community mutual-aid PWA with nearby official resources, community posts, and lightweight verification.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/app-icon.svg',
    apple: '/icons/app-icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WeaveNYC',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#f4ece0',
  viewportFit: 'cover',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  // Render the English skip-link copy in the SSG shell. Once providers
  // re-render under NextIntlClientProvider, screens can compose their own
  // localized skip links; but because the skip-link lives above Providers
  // (so it is reachable before any client hydration), the static English
  // string here is the correct fallback and is simultaneously the fallback
  // screen readers receive when JS is disabled.
  const skipLinkLabel = messages[INITIAL_LANGUAGE].skipToContent;

  return (
    <html
      lang={INITIAL_LANGUAGE}
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${notoSerifSC.variable} ${notoSansSC.variable}`}
    >
      <body>
        <a className="skip-link" href="#main-content">
          {skipLinkLabel}
        </a>
        <Providers initialLanguage={INITIAL_LANGUAGE}>
          <PwaRegistration />
          {/*
           * RouteGuards runs `useOnboardingGuard` which reads
           * `useSearchParams()`. Under static export that hook must sit
           * inside a Suspense boundary, so we isolate the guard island in
           * its own Suspense wrapper and keep the rest of the tree free of
           * unnecessary suspension points.
           */}
          <Suspense fallback={null}>
            <RouteGuards />
          </Suspense>
          {/*
           * ShellFrame picks usePathname() and conditionally wraps the
           * active route in <AppShell> (top bar + main#main-content +
           * bottom tab bar). Onboarding routes bypass the shell and own
           * their own <main id="main-content"> landmark so the skip-link
           * target is always present exactly once on every page.
           */}
          <ShellFrame>{children}</ShellFrame>
        </Providers>
      </body>
    </html>
  );
}
