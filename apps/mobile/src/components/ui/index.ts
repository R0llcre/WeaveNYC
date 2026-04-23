/**
 * UI atoms — public barrel.
 * =========================
 *
 * Consumers (screens, composite components) import atoms from this path:
 *
 *   import { Pill, Tag, Banner } from '@/components/ui';
 *
 * R2 scope: the first primary-atom wave from the PWA — `Pill` (selectable
 * chip), `Tag` (non-interactive label), and `Banner` (inline advisory
 * surface). Subsequent waves add their atoms via their own export blocks —
 * screens must never reach into the component module directly, so the
 * barrel stays the single cross-cutting import path.
 */

export { Pill } from './Pill';
export type { PillProps } from './Pill';

export { Tag } from './Tag';
export type { TagProps, TagTone } from './Tag';

export { Banner } from './Banner';
export type { BannerProps, BannerTone } from './Banner';
