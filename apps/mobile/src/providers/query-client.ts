/**
 * TanStack Query client — single instance for the whole app.
 *
 * The PWA persists its query cache into IndexedDB via
 * `@tanstack/query-sync-storage-persister`; the RN equivalent uses MMKV
 * (wave B wires `react-native-mmkv` in as the sync storage backend).
 * For M1 we ship the in-memory cache only so the shell boots without a
 * native module dependency.
 *
 * Defaults match the PWA:
 *   - staleTime: 30s so back/forward navigation doesn't refetch.
 *   - retry: 2 (network can blink on mobile; 2 retries is enough).
 *   - refetchOnWindowFocus: false — the mobile "focus" event fires on
 *     tab switch and would cause thundering refetches.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
