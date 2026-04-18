'use client';

import { forwardRef } from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 28,
  md: 40,
  lg: 56,
};

/**
 * Palette of accent-tinted backgrounds used for name-hashed avatars. All
 * entries reference tokens from W1A's palette so the atom stays themeable
 * and never hardcodes hex.
 */
const HASH_TONES: Array<{ bg: string; fg: string }> = [
  { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent-strong)' },
  {
    bg: 'var(--color-community-soft, var(--color-accent-soft))',
    fg: 'var(--color-community, var(--color-accent-strong))',
  },
  {
    bg: 'var(--color-verified-soft, var(--color-success-soft))',
    fg: 'var(--color-verified, var(--color-success))',
  },
  {
    bg: 'var(--color-urgent-soft, var(--color-warning-soft))',
    fg: 'var(--color-urgent, var(--color-warning))',
  },
  { bg: 'var(--color-info-soft)', fg: 'var(--color-info)' },
];

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * User-facing display name. The first character of each whitespace-split
   * segment is used to build the 1–2 letter monogram. When `name` is empty
   * the avatar falls back to the provided `fallbackGlyph` (default: a
   * generic person silhouette).
   */
  name?: string;
  /**
   * Explicit initials override. Useful when the caller has already
   * calculated "KR" from "Kai Ryan" and wants to skip the atom's heuristic.
   */
  initials?: string;
  size?: AvatarSize;
  /** Inline SVG node used when `name` is empty. */
  fallbackGlyph?: React.ReactNode;
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    const first = parts[0];
    return (first.charAt(0) + (first.charAt(1) ?? '')).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function hashIndex(key: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0; // clamp to 32-bit int
  }
  return Math.abs(hash) % mod;
}

/**
 * Avatar — initials on a name-hashed tinted background.
 *
 * Deterministic colour selection means the same display name always gets
 * the same tint across sessions and devices. The atom is purely
 * presentational and defers translation/truncation to the caller.
 */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { name = '', initials, size = 'md', fallbackGlyph, className, style, ...rest },
  ref,
) {
  const resolved = initials ?? initialsFromName(name);
  const toneIndex = hashIndex(name || 'default', HASH_TONES.length);
  const tone = HASH_TONES[toneIndex];
  const px = SIZE_PX[size];
  const classes = ['avatar', `avatar--${size}`, className ?? ''].filter(Boolean).join(' ');
  const hasInitials = resolved.length > 0;

  return (
    <span
      {...rest}
      ref={ref}
      className={classes}
      aria-hidden={rest['aria-label'] ? undefined : true}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: px,
        height: px,
        borderRadius: '50%',
        background: tone.bg,
        color: tone.fg,
        fontSize: Math.round(px * 0.42),
        fontWeight: 700,
        letterSpacing: '-0.02em',
        ...style,
      }}
    >
      {hasInitials ? (
        <span className="avatar__initials">{resolved}</span>
      ) : (
        <span aria-hidden="true" className="avatar__glyph">
          {fallbackGlyph ?? (
            <svg viewBox="0 0 24 24" width={Math.round(px * 0.55)} height={Math.round(px * 0.55)}>
              <path
                fill="currentColor"
                d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3 0-8 1.5-8 4.5V20h16v-1.5c0-3-5-4.5-8-4.5Z"
              />
            </svg>
          )}
        </span>
      )}
    </span>
  );
});
