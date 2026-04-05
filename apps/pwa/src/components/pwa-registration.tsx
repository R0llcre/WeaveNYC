'use client';

import { useEffect } from 'react';

export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerWorker = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (error) {
        console.error('Service worker registration failed', error);
      }
    };

    void registerWorker();
  }, []);

  return null;
}
