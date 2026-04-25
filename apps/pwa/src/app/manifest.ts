import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WeaveNYC',
    short_name: 'WeaveNYC',
    description: 'WeaveNYC community mutual-aid PWA with official resources, community join, posts, and lightweight verification.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4ece0',
    theme_color: '#f4ece0',
    icons: [
      {
        src: '/icons/app-icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
      },
      {
        src: '/icons/icon-192.png',
        type: 'image/png',
        sizes: '192x192',
      },
      {
        src: '/icons/icon-512.png',
        type: 'image/png',
        sizes: '512x512',
      },
      {
        src: '/icons/maskable-icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'maskable',
      },
    ],
  };
}
