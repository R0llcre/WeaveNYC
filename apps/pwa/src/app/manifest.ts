import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WeaveNYC',
    short_name: 'WeaveNYC',
    description: 'WeaveNYC community mutual-aid PWA with official resources, community join, posts, and lightweight verification.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f4ed',
    theme_color: '#f6efe3',
    icons: [
      {
        src: '/icons/app-icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
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
