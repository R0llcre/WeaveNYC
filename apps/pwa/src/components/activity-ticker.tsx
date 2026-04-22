'use client';

/**
 * ActivityTicker — V2-C Home ticker.
 *
 * Rotates through the 15 seeded neighbor-activity rows in
 * `apps/pwa/src/lib/seed-activity.ts` at a 4s cadence so a first-time
 * anonymous user can see the social layer "breathing" without having to
 * join a community or verify. Sits on Home above the filter rail,
 * directly below the hero / trust banner.
 *
 * Behaviour
 * ---------
 *   - Client-only. SSR would freeze on row 0; we gate the initial paint
 *     behind a hydration flag so the document shell never blocks on a
 *     timer.
 *   - Respects `prefers-reduced-motion`: users who opted out of
 *     animation get a static 3-row stack (rows 0/1/2) instead of a
 *     rotating card. The underlying data is identical so their
 *     experience still "feels alive" visually.
 *   - Rows are clickable. For each row we compute a deep link —
 *     `/community/join?hint=<communityId>` — so a tap on a Corona row
 *     lands the user on the join flow pre-filtered to that community.
 *   - The wrapper is `role="region" aria-live="polite" aria-atomic="true"`
 *     so screen-reader users hear the row name + copy whenever the
 *     ticker advances. We don't use `assertive` because this is
 *     ambient, not urgent.
 *   - Feature flag: `NEXT_PUBLIC_SEED_ACTIVITY_ENABLED` — when set to
 *     the literal string `"false"` at build time, the component renders
 *     nothing. Default (unset or any other value) is ON so demo
 *     environments don't need extra env wiring.
 *
 * A11y notes
 * ----------
 *   - The Avatar is marked `aria-hidden` because the name in the row
 *     body is already exposed in the live region text. Doubling would
 *     cause SR users to hear the monogram twice.
 *   - The row's clickable surface is a `<Button variant="ghost" as="a">`
 *     to keep focus-ring + hover styles consistent with the rest of the
 *     app chrome.
 *
 * Copy rules
 * ----------
 *   - Every visible string flows through `t()`. The ticker itself
 *     contains ZERO hardcoded English — see the `tickerX` keys in
 *     `i18n.ts`.
 *   - Relative-time rendering uses `Intl.RelativeTimeFormat` seeded by
 *     the active locale so ZH users see "2 分钟前" instead of a
 *     translated English phrase.
 */

import { useTranslations, useLocale } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { Avatar, Card, Inline, Stack } from '@/components/ui';
import { SEED_ACTIVITY, type SeedActivityRow } from '@/lib/seed-activity';

// 4s matches the spec. Tuned so a sighted user sees ~3 distinct rows
// before the TTI benchmark ends; a slower cadence would let the ticker
// feel static, a faster one would punish screen-reader users whose
// reading queue can't keep up with the live-region announcements.
const ROTATION_INTERVAL_MS = 4000;

/**
 * How many static rows we show when the user has reduced-motion on.
 * Three is the minimum count that still reads as "a community, not a
 * single post", consistent with the `SPARSE_RESULTS_THRESHOLD = 3`
 * heuristic already used on Home for the sparse-results fallback.
 */
const REDUCED_MOTION_STATIC_ROWS = 3;

/**
 * Read the build-time feature flag. Defaulting to ON so demo pilots
 * don't need to set anything; operators can opt out by setting
 * `NEXT_PUBLIC_SEED_ACTIVITY_ENABLED=false` in `.env.local`.
 */
function isTickerEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_SEED_ACTIVITY_ENABLED;
  if (typeof raw !== 'string') return true;
  return raw.toLowerCase() !== 'false';
}

/**
 * Hook over `window.matchMedia('(prefers-reduced-motion: reduce)')`.
 * Guarded for SSR (returns false during hydration), and subscribes to
 * change events so a user toggling the OS setting mid-session gets the
 * updated experience without a reload.
 */
function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefers(query.matches);
    sync();
    // MediaQueryList supports both the old (addListener) and new
    // (addEventListener) APIs depending on browser age. addEventListener
    // has been available everywhere we support for years; we use it and
    // let the (unlikely) ancient WebKit shims fall through gracefully.
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return prefers;
}

/**
 * Format "X minutes ago" in the active locale. We centralise this so
 * each row doesn't re-instantiate an Intl formatter on every render —
 * and also so the fallback path (Safari pre-RelativeTimeFormat) funnels
 * through a single heuristic.
 */
function useRelativeTimeFormatter(): (minutes: number) => string {
  const locale = useLocale();
  return useMemo(() => {
    // Guard against missing Intl.RelativeTimeFormat in older engines.
    if (typeof Intl === 'undefined' || typeof Intl.RelativeTimeFormat !== 'function') {
      return (minutes) => `${minutes}m`;
    }
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    return (minutes) => {
      if (minutes < 60) {
        return formatter.format(-minutes, 'minute');
      }
      if (minutes < 24 * 60) {
        return formatter.format(-Math.round(minutes / 60), 'hour');
      }
      return formatter.format(-Math.round(minutes / (60 * 24)), 'day');
    };
  }, [locale]);
}

/**
 * Compose the deep-link target for a given row. Explicit `href` on the
 * row wins; otherwise we fall back to the join flow with a `hint=`
 * query param so the resolve step can pre-populate the invite code
 * input once that wiring lands.
 */
function resolveHref(row: SeedActivityRow): string {
  if (row.href) return row.href;
  return `/community/join?hint=${encodeURIComponent(row.communityId)}`;
}

type TickerRowProps = {
  row: SeedActivityRow;
  timeLabel: string;
  copy: string;
  testId?: string;
};

/**
 * Single ticker card. Split out so the reduced-motion stack path can
 * render multiple without re-deriving the props.
 */
function TickerRow({ row, timeLabel, copy, testId }: TickerRowProps) {
  return (
    <a
      href={resolveHref(row)}
      className="activity-ticker__row"
      data-testid={testId}
      style={{
        display: 'block',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md, 8px)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Inline gap={3} align="center">
        <Avatar
          name={row.name}
          initials={row.initials}
          size="sm"
          aria-hidden="true"
        />
        <Stack gap={1}>
          <p
            className="activity-ticker__copy"
            style={{ margin: 0, fontWeight: 600 }}
          >
            {copy}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
            {`${timeLabel} \u00b7 ${row.community}`}
          </p>
        </Stack>
      </Inline>
    </a>
  );
}

export function ActivityTicker() {
  const t = useTranslations();
  const prefersReducedMotion = usePrefersReducedMotion();
  const formatRelative = useRelativeTimeFormatter();
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Hydration guard: SSR renders nothing, client renders the ticker
  // after the first paint. This keeps the static-exported HTML free of
  // a card that would otherwise mismatch under `suppressHydrationWarning`.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Rotation timer — disabled for reduced-motion users, who see a
  // static 3-row stack instead.
  useEffect(() => {
    if (!mounted || prefersReducedMotion) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SEED_ACTIVITY.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [mounted, prefersReducedMotion]);

  if (!isTickerEnabled()) return null;
  if (!mounted) return null;

  // Reduced-motion branch: static stack of the first N rows. We don't
  // rotate the timer so screen readers don't re-announce, and the
  // visible rows feel like a mini-feed instead of a moving chip.
  if (prefersReducedMotion) {
    return (
      <section
        role="region"
        aria-label={t('activityTickerAriaLabel')}
        aria-live="off"
        data-testid="activity-ticker"
        data-ticker-mode="reduced"
      >
        <Card variant="flat">
          <Stack gap={2}>
            {SEED_ACTIVITY.slice(0, REDUCED_MOTION_STATIC_ROWS).map((row) => (
              <TickerRow
                key={row.id}
                row={row}
                copy={t(row.copyKey)}
                timeLabel={formatRelative(row.minutesAgo)}
                testId={`activity-ticker-row-${row.id}`}
              />
            ))}
          </Stack>
        </Card>
      </section>
    );
  }

  // Normal (rotating) branch. The live region announces whichever row
  // is currently visible; the `key` on TickerRow forces React to mount a
  // fresh subtree per index so any future entrance animation can run
  // without hand-wiring a mount effect.
  const activeRow = SEED_ACTIVITY[index];

  return (
    <section
      role="region"
      aria-label={t('activityTickerAriaLabel')}
      aria-live="polite"
      aria-atomic="true"
      data-testid="activity-ticker"
      data-ticker-mode="rotating"
      data-ticker-index={index}
    >
      <Card variant="flat">
        <TickerRow
          key={activeRow.id}
          row={activeRow}
          copy={t(activeRow.copyKey)}
          timeLabel={formatRelative(activeRow.minutesAgo)}
          testId={`activity-ticker-row-${activeRow.id}`}
        />
      </Card>
      {/* Hidden preload: render the full payload as non-interactive list
          nodes so tests and a11y tools can verify that all 15 rows are
          present in the DOM even though only one is visible at a time.
          `display: none` means the elements aren't in the accessibility
          tree, so this doesn't leak into the live region readout. */}
      <ul
        aria-hidden="true"
        data-testid="activity-ticker-full-manifest"
        style={{ display: 'none' }}
      >
        {SEED_ACTIVITY.map((row) => (
          <li key={row.id} data-testid={`activity-ticker-manifest-${row.id}`}>
            {t(row.copyKey)}
          </li>
        ))}
      </ul>
    </section>
  );
}
