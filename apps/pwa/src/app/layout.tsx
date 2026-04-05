import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';
import { PwaRegistration } from '@/components/pwa-registration';

import './globals.css';

export const metadata: Metadata = {
  title: 'WeaveNYC PWA',
  description: 'M0 shell for API health checks and anonymous session bootstrap.',
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
    <html lang="en">
      <body>
        <Providers>
          <PwaRegistration />
          {children}
        </Providers>
      </body>
    </html>
  );
}
