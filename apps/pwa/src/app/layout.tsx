import { headers } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';
import { coerceSupportedLanguage } from '@/lib/i18n';
import { PwaRegistration } from '@/components/pwa-registration';

import './globals.css';

export const metadata: Metadata = {
  title: 'WeaveNYC PWA',
  description: 'WeaveNYC M1 resource finder with nearby official food support, local bookmarks, and lightweight verification.',
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

export default async function RootLayout({ children }: RootLayoutProps) {
  const requestHeaders = await headers();
  const initialLanguage = coerceSupportedLanguage(requestHeaders.get('accept-language'));

  return (
    <html lang={initialLanguage} suppressHydrationWarning>
      <body>
        <Providers initialLanguage={initialLanguage}>
          <PwaRegistration />
          {children}
        </Providers>
      </body>
    </html>
  );
}
