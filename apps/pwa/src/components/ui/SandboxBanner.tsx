'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { isDemoSandbox } from '@/lib/demo';

/**
 * SandboxBanner — persistent amber "SANDBOX" pill pinned to the top-right
 * of the shell, plus a one-shot visible marker that this app instance is
 * running in demo-sandbox mode.
 *
 * Mounted once from `app/layout.tsx` so it survives client-side route
 * transitions. Renders `null` on the server and on any origin where
 * `isDemoSandbox()` returns false, keeping the production bundle free of
 * stray sandbox UI even if a user attaches `?demo=1` to a weavenyc.org
 * URL.
 *
 * Production-origin safety: the hostname check in `isDemoSandbox()`
 * returns false for `weavenyc.org` unless the hostname also looks like
 * a preview (`*.pages.dev`, `*.vercel.app`) or localhost; the banner
 * piggy-backs on that gate.
 */
export function SandboxBanner() {
  const t = useTranslations();
  // Resolve on first client render so SSG HTML never ships the sandbox
  // pill. Also re-check if the URL search string changes (e.g. user
  // appends `?demo=1`) — we poll once on mount because Next's
  // useSearchParams would re-render the banner on every query change and
  // create a large observable surface; the pill state is stable enough
  // that a single mount-time check is fine.
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isDemoSandbox());
  }, []);

  if (!active) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sandbox-pill"
      data-testid="sandbox-pill"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        right: '8px',
        zIndex: 9999,
        padding: '4px 10px',
        borderRadius: '999px',
        background: '#f59e0b',
        color: '#1f2937',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
        pointerEvents: 'none'
      }}
    >
      {t('demoSandboxPill')}
    </div>
  );
}
