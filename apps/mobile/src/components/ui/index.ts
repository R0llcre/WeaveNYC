/**
 * UI atom barrel — public surface of the mobile design-system primitives.
 * =======================================================================
 *
 * Consumers import a single named entry point:
 *
 *   import { PageHeader, Skeleton, ResourceCard } from '@/components/ui';
 *
 * The barrel keeps import paths stable as atoms are added, renamed, or
 * extracted into a shared package. It also gives the linter a single
 * surface to sort and dedupe.
 *
 * Atoms in this barrel as of M4b:
 *   - PageHeader               — screen-top title + back chevron
 *   - Skeleton                 — reanimated shimmer placeholder
 *   - ResourceCard             — the discovery card (biggest atom)
 *   - RouteLoadingFallback     — Suspense placeholder
 *   - SandboxBanner            — demo-mode strip
 *
 * Atoms ported in sibling PR M4a (Avatar / Checkbox / Radio / Icon /
 * IconButton) will extend this barrel in the same style when that PR
 * lands.
 */

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { Skeleton } from './Skeleton';
export type { SkeletonProps, SkeletonVariant } from './Skeleton';

export { ResourceCard } from './ResourceCard';
export type {
  ResourceCardProps,
  ResourceCardResource,
  ResourceCardLabels,
  ResourceCardCategory,
} from './ResourceCard';

export { RouteLoadingFallback } from './RouteLoadingFallback';
export type { RouteLoadingFallbackProps } from './RouteLoadingFallback';

export { SandboxBanner, isDemoSandboxBuild } from './SandboxBanner';
export type { SandboxBannerProps } from './SandboxBanner';
