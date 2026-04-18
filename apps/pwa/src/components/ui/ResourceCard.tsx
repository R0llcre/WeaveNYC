'use client';

import { forwardRef, useId } from 'react';

import type { IconName } from '../../assets/icons/registry';
import { Icon, type IconTone } from './Icon';
import { IconButton } from './IconButton';

export type ResourceCardCategory =
  | 'food'
  | 'pantry'
  | 'kitchen'
  | 'market'
  | 'benefits'
  | 'goods'
  | 'childcare'
  | 'companionship'
  | 'translation'
  | 'transportation'
  | 'health'
  | 'other';

/**
 * Categories are a product taxonomy; icons are a design-system inventory.
 * This table is the single source of truth for translating from one to the
 * other, so consumers never guess and unit tests can exhaustively verify
 * the mapping exists.
 */
const CATEGORY_ICON: Record<ResourceCardCategory, IconName> = {
  food: 'food',
  pantry: 'food',
  kitchen: 'meal',
  market: 'fresh',
  benefits: 'money',
  goods: 'clothing',
  childcare: 'general', // no closer fit in the current icon set
  companionship: 'chat',
  translation: 'chat',
  transportation: 'transport',
  health: 'health',
  other: 'general',
};

/**
 * Tone mapping matches the community-driven palette: food/meal/fresh read
 * as brand accent; health uses the verified green; money/benefits speak
 * community purple; crisis-style categories would go urgent (none in the
 * current taxonomy, but the mapping leaves room).
 */
const CATEGORY_TONE: Record<ResourceCardCategory, IconTone> = {
  food: 'accent',
  pantry: 'accent',
  kitchen: 'accent',
  market: 'accent',
  benefits: 'community',
  goods: 'accent',
  childcare: 'accent',
  companionship: 'accent',
  translation: 'accent',
  transportation: 'accent',
  health: 'verified',
  other: 'accent',
};

export interface ResourceCardResource {
  id: string;
  name: string;
  category?: ResourceCardCategory;
  /**
   * Preformatted distance string (e.g. "0.4 mi", "200 m"). The atom never
   * formats units itself — i18n + locale rules live in the caller.
   */
  distanceLabel?: string;
  /** Preformatted "Open now" / "Open today · 9am–5pm" string. */
  hoursLabel?: string;
  address?: string;
  phone?: string | null;
  bookmarked?: boolean;
}

export interface ResourceCardLabels {
  /** aria-label for the main card button (e.g. "Open details for {name}") */
  openLabel: string;
  /** aria-label for the bookmark toggle (e.g. "Save {name}") */
  bookmarkLabel: string;
  /** aria-label when already bookmarked (e.g. "Remove {name} from saved") */
  bookmarkedLabel?: string;
  /** aria-label for phone call button */
  callLabel: string;
  /** aria-label for directions button */
  directionsLabel: string;
}

export interface ResourceCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick' | 'resource'> {
  resource: ResourceCardResource;
  labels: ResourceCardLabels;
  onOpen?: (id: string) => void;
  onBookmark?: (id: string) => void;
  onCall?: (phone: string, id: string) => void;
  onDirections?: (id: string) => void;
  /**
   * Optional custom icon content for the category tile. When omitted, the
   * atom resolves a registered icon via `CATEGORY_ICON[category]`.
   */
  categoryIcon?: React.ReactNode;
  /**
   * Extended context for screen reader users (e.g. distance + hours +
   * address concatenated into a natural sentence). When provided, this is
   * wired to the main button via `aria-describedby` and kept visually
   * hidden.
   */
  ariaDescription?: string;
}

/**
 * ResourceCard — the central atom for discovery surfaces.
 *
 * Layout (mobile-first):
 * ```
 * ┌───────────────────────────────────────────┐
 * │ [icon] Name · 0.4 mi                  [♡] │
 * │        Open now · 9am–5pm                 │
 * │        123 Main St                        │
 * │                                   [📞][🧭]│
 * └───────────────────────────────────────────┘
 * ```
 * The main card surface is a `<button>` so the whole tile is one tap target
 * for "open details". The bookmark, call, and directions icon buttons are
 * siblings (not nested) so we stay WCAG-compliant with no interactive
 * descendants inside another button.
 */
export const ResourceCard = forwardRef<HTMLElement, ResourceCardProps>(function ResourceCard(
  {
    resource,
    labels,
    onOpen,
    onBookmark,
    onCall,
    onDirections,
    categoryIcon,
    ariaDescription,
    className,
    ...rest
  },
  ref,
) {
  const { id, name, category, distanceLabel, hoursLabel, address, phone, bookmarked } = resource;
  const classes = ['resource-card-atom', className ?? ''].filter(Boolean).join(' ');
  const bookmarkedAria = bookmarked
    ? labels.bookmarkedLabel ?? labels.bookmarkLabel
    : labels.bookmarkLabel;
  const resolvedCategory: ResourceCardCategory = category ?? 'other';
  const iconName = CATEGORY_ICON[resolvedCategory];
  const iconTone = CATEGORY_TONE[resolvedCategory];
  // Stable id per instance for aria-describedby wiring; falls back to the
  // resource id when useId's output is unavailable (SSR shouldn't hit this).
  const descriptionDomId = useId();
  // `data-testid` isn't part of the HTMLAttributes signature, so we pull it
  // off `rest` by index access and let any consumer override take priority.
  const restWithTestId = rest as Record<string, unknown>;
  const providedTestId =
    typeof restWithTestId['data-testid'] === 'string'
      ? (restWithTestId['data-testid'] as string)
      : undefined;
  const resolvedTestId = providedTestId ?? `resource-card-${id}`;

  return (
    <article
      {...rest}
      ref={ref}
      className={classes}
      data-resource-id={id}
      data-category={category}
      data-testid={resolvedTestId}
    >
      <button
        type="button"
        className="resource-card-atom__open"
        aria-label={labels.openLabel}
        aria-describedby={ariaDescription ? descriptionDomId : undefined}
        onClick={onOpen ? () => onOpen(id) : undefined}
        data-testid={`resource-detail-${id}`}
      >
        <span className="resource-card-atom__icon" aria-hidden="true">
          <Icon name={iconName} size="md" tone={iconTone}>
            {categoryIcon}
          </Icon>
        </span>
        <span className="resource-card-atom__body">
          <span className="resource-card-atom__row resource-card-atom__row--title">
            <span className="resource-card-atom__name">{name}</span>
            {distanceLabel ? (
              <span className="resource-card-atom__distance">{distanceLabel}</span>
            ) : null}
          </span>
          {hoursLabel ? (
            <span className="resource-card-atom__hours">{hoursLabel}</span>
          ) : null}
          {address ? (
            <span className="resource-card-atom__address">{address}</span>
          ) : null}
        </span>
      </button>

      {ariaDescription ? (
        <span
          id={descriptionDomId}
          className="sr-only"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {ariaDescription}
        </span>
      ) : null}

      {onBookmark ? (
        <span className="resource-card-atom__bookmark">
          <IconButton
            variant="ghost"
            size="sm"
            shape="circle"
            tone={bookmarked ? 'community' : 'neutral'}
            aria-label={bookmarkedAria}
            aria-pressed={bookmarked ? 'true' : 'false'}
            onClick={() => onBookmark(id)}
            data-testid={`bookmark-${id}`}
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
              {bookmarked ? (
                <path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1Z" />
              ) : (
                <path d="M18 4H6a1 1 0 0 0-1 1v16l7-4 7 4V5a1 1 0 0 0-1-1Zm-1 14.4-5-2.86-5 2.86V6h10Z" />
              )}
            </svg>
          </IconButton>
        </span>
      ) : null}

      {(phone && onCall) || onDirections ? (
        <span className="resource-card-atom__actions">
          {phone && onCall ? (
            <IconButton
              variant="tonal"
              size="sm"
              tone="accent"
              aria-label={labels.callLabel}
              onClick={() => onCall(phone, id)}
              data-testid={`phone-${id}`}
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                <path d="M20 15.5a11 11 0 0 1-3.46-.55 1 1 0 0 0-1 .24l-2.15 2.15a15 15 0 0 1-6.73-6.73l2.15-2.15a1 1 0 0 0 .24-1A11 11 0 0 1 8.5 4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1A17 17 0 0 0 20 21a1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1Z" />
              </svg>
            </IconButton>
          ) : null}
          {onDirections ? (
            <IconButton
              variant="tonal"
              size="sm"
              tone="community"
              aria-label={labels.directionsLabel}
              onClick={() => onDirections(id)}
              data-testid={`directions-${id}`}
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                <path d="m21.7 11.3-9-9a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4ZM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5L17.5 11Z" />
              </svg>
            </IconButton>
          ) : null}
        </span>
      ) : null}
    </article>
  );
});
