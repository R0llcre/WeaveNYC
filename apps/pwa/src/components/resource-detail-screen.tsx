'use client';

/**
 * ResourceDetailScreen — M8.5 Wave 4C redesign (W4 R3 blocker fixes applied).
 *
 * One resource, one story. The previous version leaned on `PageHeader`
 * actions and a legacy 2-col `.grid--detail` split that felt like an admin
 * table. This rewrite follows §4 Wave 4C of the redesign plan:
 *
 *   TopBar (backHref="/")
 *     Cover / Hero   — large category tile + overline + h1 + open/distance
 *                      + a single bookmark IconButton (testid
 *                      `bookmark-{providerId}` — E2E load-bearing).
 *     Primary CTA    — Call / Directions (bookmark lives in hero)
 *     Metadata grid  — `<dl class="metric-list">` hours / address / phone /
 *                      website / languages
 *                      (Eligibility row removed — ResourceDetail has no
 *                      distinct `eligibility` field, and the old row just
 *                      mirrored `notes`; see W4 R3 B3.)
 *     Weekly hours   — full 7-day breakdown under the `hoursTitle` heading
 *     Description    — notes paragraph under the `notesTitle` heading
 *     Tags           — service-level language pills + source (category is
 *                      removed here — it already shows in the overline and
 *                      the metadata band; see W4 R3 L1).
 *     Actions row    — Share (the Save/Remove CTA button was removed; the
 *                      hero bookmark is the single bookmark control — see
 *                      W4 R3 B2).
 *
 * Loading:  skeleton cover + metric-list skeleton rows.
 * 404:      <EmptyState illustrationName="error"> with back-home CTA.
 *
 * E2E / testid preservation:
 *   - `bookmark-{providerId}` stays on the hero IconButton — the single
 *     bookmark control for this page.
 *   - `resource-detail-{field}` spans: title, category, hours, address,
 *     phone, website, languages, notes, source, call, directions, share.
 *   - Existing translation keys reused verbatim so the Playwright smoke
 *     (`Horario semanal`, `Notas`) keeps matching.
 *
 * Atoms only: Stack / Inline / Card / Button / IconButton / Icon / Tag /
 * Toast / Skeleton / EmptyState from `@/components/ui`, plus the shared
 * `TopBar`. No inline `<svg>` — all glyphs come from the W1C icon
 * registry via the `<Icon />` atom (see W4 R3 H2).
 */

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { TopBar } from '@/components/shell';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Inline,
  Skeleton,
  Stack,
  Tag,
  Toast,
} from '@/components/ui';
import { resolveErrorKey } from '@/lib/error-i18n';
import { useAppDispatch, useAppSelector, useResource } from '@/lib/hooks';
import { getTypeLabel } from '@/lib/i18n';
import {
  selectPreferencesBookmarks,
  selectPreferencesLanguage,
  selectPreferencesZipCode,
} from '@/lib/selectors';
import { toggleBookmark } from '@/lib/slices/preferences-slice';
import type {
  ResourceDetail,
  ResourceHoursEntry,
  ResourceFilterType,
  SupportedLanguage,
} from '@/lib/types';
import { narrowResourceType } from '@/lib/types';
import type { IconName } from '@/assets/icons/registry';

type ResourceDetailScreenProps = {
  providerId: string;
};

/**
 * Map the backend resource `type` onto a registered icon glyph. Mirrors the
 * mapping in `ResourceCard.tsx` (private) so the detail hero and the list
 * card share a visual category language, even though the types happen to
 * be a subset of the ResourceCard category taxonomy.
 */
// Icons keyed by the 5 first-class categories; public-ingest types (PR #70)
// route through narrowResourceType() to reuse the same icon vocabulary.
const TYPE_ICON: Record<
  'pantry' | 'kitchen' | 'market' | 'benefits' | 'other',
  IconName
> = {
  pantry: 'food',
  kitchen: 'meal',
  market: 'fresh',
  benefits: 'money',
  other: 'general',
};

// Local, self-contained day label map. The backend hours rows use lowercase
// ISO-ish day keys ("mon", "tue", ...); we localize them in place rather
// than reach for a new i18n key per day to keep the key surface small.
const DAY_LABELS: Record<string, Record<SupportedLanguage, string>> = {
  mon: { en: 'Mon', es: 'Lun', zh: '周一' },
  tue: { en: 'Tue', es: 'Mar', zh: '周二' },
  wed: { en: 'Wed', es: 'Mié', zh: '周三' },
  thu: { en: 'Thu', es: 'Jue', zh: '周四' },
  fri: { en: 'Fri', es: 'Vie', zh: '周五' },
  sat: { en: 'Sat', es: 'Sáb', zh: '周六' },
  sun: { en: 'Sun', es: 'Dom', zh: '周日' },
};

const DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function formatDayLabel(day: string, language: SupportedLanguage): string {
  return DAY_LABELS[day]?.[language] ?? day.toUpperCase();
}

function formatHoursWindows(entry: ResourceHoursEntry, closedCopy: string): string {
  if (entry.closed || entry.windows.length === 0) {
    return closedCopy;
  }
  return entry.windows
    .map((window) => `${window.opens_at} – ${window.closes_at}`)
    .join(' / ');
}

export function ResourceDetailScreen({ providerId }: ResourceDetailScreenProps) {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const zipCode = useAppSelector(selectPreferencesZipCode);
  const language = useAppSelector(selectPreferencesLanguage);
  const bookmarks = useAppSelector(selectPreferencesBookmarks);
  const resourceQuery = useResource(providerId, zipCode || undefined);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Per-route document title stays identical to the previous version so
  // analytics and browser history don't regress.
  useEffect(() => {
    document.title = `${t('pageTitleResourceDetail')} \u2014 WeaveNYC`;
  }, [t]);

  const resource: ResourceDetail | null = resourceQuery.data ?? null;
  const isLoading = resourceQuery.isLoading;
  const isError = !isLoading && (resourceQuery.isError || !resource);
  const bookmarked = resource ? bookmarks.includes(resource.provider_id) : false;
  // Derive the hours row that represents "today" so the metadata grid can
  // surface it as a quick-scan value. Falls back to the first non-closed
  // row, then to the first row, so the UI never renders an empty string.
  const todayHours = useMemo(() => {
    if (!resource) return null;
    const todayIdx = new Date().getDay();
    const todayKey = Object.keys(DAY_INDEX).find((key) => DAY_INDEX[key] === todayIdx);
    const byToday = todayKey
      ? resource.weekly_hours.find((entry) => entry.day === todayKey)
      : undefined;
    if (byToday) return byToday;
    const firstOpen = resource.weekly_hours.find((entry) => !entry.closed);
    return firstOpen ?? resource.weekly_hours[0] ?? null;
  }, [resource]);

  const categoryLabel = resource ? getTypeLabel(language, resource.type) : '';
  const openToneResolved: 'verified' | 'community' | 'urgent' = resource?.is_open_now
    ? 'verified'
    : resource?.is_open_today
      ? 'community'
      : 'urgent';

  const distanceLabel =
    resource && resource.distance_miles !== null
      ? t('resourceCardDistanceMiles', { distance: resource.distance_miles.toFixed(1) })
      : null;

  // Map the backend `type` onto a registered icon glyph via TYPE_ICON.
  // Fall back to `general` when the resource hasn't loaded yet.
  const iconName: IconName = resource ? TYPE_ICON[narrowResourceType(resource.type)] : 'general';

  const handleBookmark = useCallback(() => {
    if (!resource) return;
    dispatch(toggleBookmark(resource.provider_id));
  }, [dispatch, resource]);

  const handleShare = useCallback(async () => {
    if (!resource || typeof window === 'undefined') return;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = { title: resource.name, text: resource.name, url };
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator && navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareToast(t('resourceDetailShareCopied'));
        window.setTimeout(() => setShareToast(null), 2000);
      }
    } catch {
      // Share cancellation / clipboard denial is a no-op; the user keeps the
      // URL visible in the address bar.
    }
  }, [resource, t]);

  // ---- State: 404 / error ------------------------------------------------
  if (isError) {
    return (
      <div className="page-content" data-screen="resource-detail">
        <TopBar
          variant="page"
          eyebrow={t('resourceDetailEyebrow')}
          title={t('resourceNotFound')}
          backHref="/"
        />
        <EmptyState
          illustrationName="error"
          tone="error"
          title={t('resourceNotFound')}
          subtitle={
            resourceQuery.error
              ? t(resolveErrorKey(resourceQuery.error))
              : t('resourceLoadError')
          }
          cta={{ label: t('backHome'), href: '/' }}
        />
      </div>
    );
  }

  // ---- State: loading ----------------------------------------------------
  if (isLoading || !resource) {
    return (
      <div className="page-content" data-screen="resource-detail">
        <TopBar
          variant="page"
          eyebrow={t('resourceDetailEyebrow')}
          title={t('resourceLoading')}
          backHref="/"
        />
        <Stack gap={5} aria-busy="true" aria-live="polite">
          <span className="sr-only">{t('resourceLoading')}</span>
          <Card variant="raised">
            <Stack gap={3}>
              <Skeleton
                variant="circle"
                width={56}
                height={56}
                label={t('resourceLoading')}
              />
              <Skeleton variant="text" height="1.4em" width="70%" />
              <Skeleton variant="text" height="1em" width="45%" />
            </Stack>
          </Card>
          <Stack gap={3}>
            <Skeleton variant="rect" height={72} />
            <Skeleton variant="rect" height={72} />
            <Skeleton variant="rect" height={72} />
          </Stack>
        </Stack>
      </div>
    );
  }

  // ---- State: loaded -----------------------------------------------------
  const todayWindowCopy = todayHours
    ? formatHoursWindows(todayHours, t('closedLabel'))
    : t('resourceCardHoursUnknown');

  return (
    <div className="page-content" data-screen="resource-detail">
      <TopBar
        variant="page"
        eyebrow={t('resourceDetailEyebrow')}
        title={resource.name}
        backHref="/"
      />

      <Stack gap={5}>
        {/* -------------------------------------------------------------- */}
        {/* Cover / Hero — category tile + title + status tags +           */}
        {/* bookmark IconButton (the single bookmark control — see B2).    */}
        {/* Card uses `variant="raised"` to keep the cover-icon tint and   */}
        {/* title on a neutral surface, avoiding the accent-on-accent      */}
        {/* contrast risk flagged in H1.                                    */}
        {/* -------------------------------------------------------------- */}
        <Card as="section" variant="raised" aria-labelledby="resource-detail-title">
          <Stack gap={3}>
            <Inline gap={3} align="center">
              <span className="resource-detail__cover-icon" aria-hidden="true">
                <Icon name={iconName} size="lg" />
              </span>
              <Stack gap={1}>
                <span
                  className="overline"
                  data-testid="resource-detail-category"
                >
                  {categoryLabel}
                </span>
                {/*
                  Wave 6D a11y: TopBar already emits the resource name as
                  the page's single <h1>. Demoting this duplicate title to
                  <h2> eliminates the "page-has-heading-one" axe-core
                  violation without losing the visible prominence — the
                  `.resource-detail__title` class still applies the h3 size
                  treatment, and the `data-testid` contract is preserved
                  for e2e locators that pin visible copy by name.
                 */}
                <h2
                  className="resource-detail__title"
                  id="resource-detail-title"
                  data-testid="resource-detail-title"
                >
                  {resource.name}
                </h2>
              </Stack>
              {/* Single bookmark affordance for the screen. Shape + tone */}
              {/* swap between outline/filled icon registry glyphs so the */}
              {/* atom stays the presentation layer; no inline <svg>.     */}
              <IconButton
                variant={bookmarked ? 'tonal' : 'ghost'}
                tone={bookmarked ? 'community' : 'neutral'}
                aria-label={
                  bookmarked
                    ? t('resourceDetailRemoveAction')
                    : t('resourceDetailSaveAction')
                }
                aria-pressed={bookmarked}
                onClick={handleBookmark}
                data-testid={`bookmark-${resource.provider_id}`}
              >
                <Icon name={bookmarked ? 'bookmark-filled' : 'bookmark'} size="sm" />
              </IconButton>
            </Inline>
            <Inline gap={2} wrap align="center">
              <Tag tone={openToneResolved} data-testid="resource-detail-status">
                {resource.is_open_now
                  ? t('resourceCardOpenNow')
                  : resource.is_open_today
                    ? t('resourceCardOpensLater')
                    : t('resourceCardClosedNow')}
              </Tag>
              {distanceLabel ? (
                <Tag tone="neutral" data-testid="resource-detail-distance">
                  {distanceLabel}
                </Tag>
              ) : null}
              {resource.source_label ? (
                <Tag tone="community" data-testid="resource-detail-source-tag">
                  {resource.source_label}
                </Tag>
              ) : null}
            </Inline>
          </Stack>
        </Card>

        {/* -------------------------------------------------------------- */}
        {/* Primary CTA row — Call / Directions. The bookmark control now  */}
        {/* lives in the hero (see B2) so this row stays tightly scoped to */}
        {/* the two outbound actions a user picks from the detail page.   */}
        {/* -------------------------------------------------------------- */}
        <Inline gap={3} wrap align="center">
          {resource.phone ? (
            <Button
              as="a"
              variant="primary"
              size="md"
              href={`tel:${resource.phone}`}
              data-testid="resource-detail-call"
            >
              {t('call')}
            </Button>
          ) : null}
          <Button
            as="a"
            variant="secondary"
            size="md"
            href={resource.directions_url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="resource-detail-directions"
          >
            {t('directions')}
          </Button>
        </Inline>

        {/* -------------------------------------------------------------- */}
        {/* Metadata grid — quick-scan key/value pairs                     */}
        {/* -------------------------------------------------------------- */}
        <section aria-label={t('resourceDetailEyebrow')}>
          <dl className="metric-list">
            <div className="metric-list__row">
              <dt>{t('resourceDetailTodayLabel')}</dt>
              <dd data-testid="resource-detail-hours-today">{todayWindowCopy}</dd>
            </div>
            <div className="metric-list__row">
              <dt>{t('resourceDetailAddressTitle')}</dt>
              <dd data-testid="resource-detail-address">
                <a
                  href={resource.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {resource.address}
                </a>
              </dd>
            </div>
            <div className="metric-list__row">
              <dt>{t('resourceDetailPhoneTitle')}</dt>
              <dd data-testid="resource-detail-phone">
                {resource.phone ? (
                  <a href={`tel:${resource.phone}`}>{resource.phone}</a>
                ) : (
                  <span className="muted">{t('notListed')}</span>
                )}
              </dd>
            </div>
            <div className="metric-list__row">
              <dt>{t('resourceDetailWebsiteTitle')}</dt>
              <dd data-testid="resource-detail-website">
                {resource.source_url ? (
                  <a
                    href={resource.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('resourceDetailVisitWebsite')}
                  </a>
                ) : (
                  <span className="muted">{t('notListed')}</span>
                )}
              </dd>
            </div>
            <div className="metric-list__row">
              <dt>{t('languagesTitle')}</dt>
              <dd data-testid="resource-detail-languages">
                {resource.languages.length > 0
                  ? resource.languages.join(', ')
                  : t('notListed')}
              </dd>
            </div>
            {/* Eligibility row removed (W4 R3 B3): `ResourceDetail` has no */}
            {/* `eligibility` field distinct from `notes`, so the row was  */}
            {/* rendering the same copy as the Notes section below. The   */}
            {/* Notes section alone is the source of truth for free-form  */}
            {/* detail copy.                                               */}
          </dl>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Weekly hours — full 7-day breakdown. Heading preserved verbatim*/}
        {/* so the Playwright smoke that matches "Horario semanal" holds.  */}
        {/* -------------------------------------------------------------- */}
        <Card as="section" aria-labelledby="resource-detail-hours-heading">
          <Stack gap={3}>
            <h2
              id="resource-detail-hours-heading"
              className="resource-detail__section-title"
            >
              {t('hoursTitle')}
            </h2>
            <dl className="metric-list" data-testid="resource-detail-hours">
              {resource.weekly_hours.map((entry) => (
                <div className="metric-list__row" key={entry.day}>
                  <dt>{formatDayLabel(entry.day, language)}</dt>
                  <dd>{formatHoursWindows(entry, t('closedLabel'))}</dd>
                </div>
              ))}
            </dl>
          </Stack>
        </Card>

        {/* -------------------------------------------------------------- */}
        {/* Description / Notes — free-form body paragraph                 */}
        {/* -------------------------------------------------------------- */}
        <Card as="section" aria-labelledby="resource-detail-notes-heading">
          <Stack gap={2}>
            <h2
              id="resource-detail-notes-heading"
              className="resource-detail__section-title"
            >
              {t('notesTitle')}
            </h2>
            <p data-testid="resource-detail-notes">
              {resource.notes ?? t('noAdditionalNotes')}
            </p>
          </Stack>
        </Card>

        {/* -------------------------------------------------------------- */}
        {/* Tags — service-level language pills + source only. Category is */}
        {/* already rendered in the hero overline and the metadata band,  */}
        {/* so re-showing it here was redundant (W4 R3 L1).                */}
        {/* -------------------------------------------------------------- */}
        {resource.source_label || resource.languages.length > 0 ? (
          <Inline as="div" gap={1} wrap>
            {resource.source_label ? (
              <Tag tone="neutral">{resource.source_label}</Tag>
            ) : null}
            {resource.languages.map((code) => (
              <Tag key={code} tone="neutral">
                {code}
              </Tag>
            ))}
          </Inline>
        ) : null}

        {/* -------------------------------------------------------------- */}
        {/* Actions row — Share only (the bookmark Save/Remove Button was  */}
        {/* removed per W4 R3 B2; the hero IconButton is the single        */}
        {/* bookmark control). All glyphs come from the `<Icon>` atom.    */}
        {/* -------------------------------------------------------------- */}
        <Inline gap={3} wrap align="center">
          <IconButton
            variant="ghost"
            aria-label={t('resourceDetailShareLabel')}
            onClick={() => void handleShare()}
            data-testid="resource-detail-share"
          >
            <Icon name="share" size="sm" />
          </IconButton>
        </Inline>

        {shareToast ? (
          <Toast
            tone="success"
            title={shareToast}
            data-testid="resource-detail-share-toast"
          />
        ) : null}

        {/* Source footer — when the resource carries a canonical upstream, */}
        {/* link it for verification.                                        */}
        {resource.source_url ? (
          <p className="muted" data-testid="resource-detail-source">
            <a
              href={resource.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {resource.source_label ?? resource.source}
            </a>
          </p>
        ) : null}
      </Stack>
    </div>
  );
}
