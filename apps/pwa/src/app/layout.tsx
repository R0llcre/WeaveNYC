import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';
import { PwaRegistration } from '@/components/pwa-registration';
import { messages } from '@/lib/i18n';

import './globals.css';

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
  themeColor: '#fbf9f5',
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
    <html lang={INITIAL_LANGUAGE} suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          {skipLinkLabel}
        </a>
        <Providers initialLanguage={INITIAL_LANGUAGE}>
          <PwaRegistration />
          {children}
        </Providers>
      </body>
    </html>
  );
}
