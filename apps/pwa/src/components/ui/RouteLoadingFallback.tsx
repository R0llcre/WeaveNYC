'use client';

import { useTranslations } from 'next-intl';

/**
 * RouteLoadingFallback — localized placeholder for route-level Suspense.
 *
 * Prior to F4-C, every app-router page rendered a literal English
 * `<p>Loading…</p>` inside its `<Suspense fallback>`. ZH/ES users saw a
 * split-second of English during hydration even though the rest of the
 * app was already localized. This component reads the active locale from
 * the NextIntlClientProvider mounted by `components/providers.tsx` and
 * emits the localized `shellLoading` string instead.
 *
 * `shellMode` controls the outer wrapper:
 *   - `"inner"` (default) — just the inner `.page-content > .card` shell,
 *      for routes that live inside the AppShell (e.g. `/inbox`,
 *      `/posts/[id]`, `/conversations/[id]`). The outer `<main>` landmark
 *      is already mounted by ShellFrame; duplicating it would confuse
 *      screen readers.
 *   - `"shell"` — renders its own `<main class="shell">` wrapper, matching
 *     the pre-F4-C behaviour of `/onboarding/*` pages which skip the
 *     shell.
 */
export function RouteLoadingFallback({
  shellMode = 'inner',
}: {
  shellMode?: 'inner' | 'shell';
}) {
  const t = useTranslations();
  const label = t('shellLoading');

  if (shellMode === 'shell') {
    return (
      <main className="shell">
        <div className="shell__inner">
          <section className="card" aria-label={label}>
            <p>{label}</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="page-content">
      <section className="card" aria-label={label}>
        <p>{label}</p>
      </section>
    </div>
  );
}
