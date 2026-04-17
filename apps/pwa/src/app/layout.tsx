import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';
import { PwaRegistration } from '@/components/pwa-registration';

import './globals.css';

// Static-export compatible: language is negotiated client-side via the
// preferences slice. Initial shell lang attribute is 'en' for the HTML
// document, which matches the default UI locale until hydration.
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
  themeColor: '#f6efe3',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang={INITIAL_LANGUAGE} suppressHydrationWarning>
      <body>
        <Providers initialLanguage={INITIAL_LANGUAGE}>
          <PwaRegistration />
          {children}
        </Providers>
      </body>
    </html>
  );
}
